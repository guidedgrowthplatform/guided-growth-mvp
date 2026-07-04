# Staging Environment — Rollout Checklist

Living tracker for standing up the separate staging/QA environment. Plan + rationale live in [`supabase-environments.md`](./supabase-environments.md); this is the execution checklist. Tick items as they land.

**Legend:** 🔴 critical path · 🟡 approval gate · ☐ todo · ☑ done

---

## Phase 0 — Baseline ☑

- ☑ Long-lived `staging` branch (promotion: feature → `staging` → `main`)
- ☑ QA app URL live: `https://guided-growth-qa.vercel.app` (Vercel, pinned to `staging`; prod untouched)
- ☑ Plan doc on `main` (MR !290 merged)
- ☑ Separate-staging-DB decision approved

## Phase 1 — Provision staging Supabase ☑

**Owner:** human (dashboard) · **Gate:** none

- ☑ Create a fresh `gg-staging` Supabase project (clean — do not hand-modify) — ref `ppyouymvnrqxcsllrmsl`
- ☑ Record ref + DB password + anon key + service_role key (keys → Vercel/secrets, never chat/repo)
- **Done when:** project exists, ref captured. _Blocks Phases 3–5._ ✓ 2026-06-10

## Phase 2 — Code scaffolding (inert) ☑

**Owner:** Claude · **Branch:** `feat/staging-supabase-wiring` → `staging` · **Gate:** none

- ☑ `[remotes.staging]` in `supabase/config.toml` (real ref `ppyouymvnrqxcsllrmsl`)
- ☑ `.github/workflows/staging-db.yml` — push to `staging` runs `db push --dry-run` only (paths `supabase/migrations/**`); a real apply needs `workflow_dispatch` + `dry_run=false`, gated by `environment: staging`. Prod is manual dispatch + `environment: production`. INERT: both jobs no-op until repo vars `STAGING_DB_ENABLED` / `PROD_DB_ENABLED` == `'true'`.
- ~~Catalog seed migration~~ **DROPPED** — the `categories`/`subcategories`/`starter_habits` tables are empty in prod and read by nothing (live catalog is `src/data/onboardingHabits.ts` → `@gg/shared`). The seed sourced empty rows from empty tables; removed (`export-catalog-seed.mjs` deleted). No catalog seeding needed — staging gets the same code-side taxonomy.
- ☑ this rollout checklist
- ☑ `voice-sync.yml` gained a **dispatch-only `sync-staging` job** (`workflow_dispatch` input `target=staging`, gated on `STAGING_DB_ENABLED`) — hourly prod job untouched
- **Done when:** merged to `staging`; nothing executes until secrets/vars exist.

**Secrets/vars this phase introduces (set later, in Phase 4):**

- GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`, `PROD_PROJECT_REF`, `PROD_DB_PASSWORD`
- GitHub secrets (voice-sync staging job, **added**): `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- GitHub repo variables (the inert switches): `STAGING_DB_ENABLED=true`, `PROD_DB_ENABLED=true`
- **Prod migration CI stays inert this pass:** `PROD_DB_ENABLED` unset, no prod secrets added.

## Phase 3 — Apply schema to staging

**Owner:** Claude · **Depends:** Phase 1 · **Gate:** 🟡 migration approval

- ☐ `supabase link --project-ref <ref>` → `db push`
- ☐ `supabase migration list` → confirm parity with prod
- ☐ Enable Custom Access Token hook in staging dashboard — **verify the toggle in the dashboard**, the SQL migration alone doesn't flip it on a fresh project
- ☐ Create the `voice-assets` Storage bucket in staging (dashboard — buckets are **not** migration-created)
- **Done when:** staging schema == prod schema; auth hook on; bucket exists.

## Phase 4 — Wire env + auth 🔴 (closes the "QA writes to prod" risk)

**Owner:** human + Claude · **Depends:** Phase 1 (+3) · **Gate:** dashboard toggles

- ☐ Vercel Preview-scope env → staging: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler 6543), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_WEB_ORIGIN` — **ALL Preview deployments** (not just `staging` branch) point at staging
- ☐ **JWT-issuer gotcha:** within a scope, client `VITE_SUPABASE_URL` and server `SUPABASE_URL` must point at the **same** project — a mismatch makes every API call fail JWT verification (wrong issuer)
- ☐ **Redeploy after the env flip** — env-var changes don't apply to existing deployments; redeploy `staging` (and previews) to pick them up
- ☐ Separate **staging PostHog project**: `VITE_POSTHOG_KEY` in Preview scope = staging project key
- ☐ Confirm Production scope still → prod
- ☐ Staging redirect allowlist (incl. QA URL) + Google OAuth client + Resend
- ☐ GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD` (☑ already added: `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` for the voice-sync staging job)
- ☐ GitHub **`staging` Environment** (native QA app): swap `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_POSTHOG_KEY` to staging values, `CAP_EXTRA_NAV_HOSTS=ppyouymvnrqxcsllrmsl.supabase.co` — `app.guidedgrowth.staging` moves to the staging DB
- **Done when:** QA app (web + native) reads/writes **staging** DB, not prod.

## Phase 5 — Sync reference content + assets

**Owner:** Claude · **Depends:** Phase 3 · **Gate:** none

- ☐ Staging voice-sync run for `screen_contexts` — dispatch `voice-sync.yml` with `target=staging` (needs `STAGING_DB_ENABLED=true` + the two `STAGING_SUPABASE_*` secrets)
- ☐ Voice-assets MP3s: copy from the prod bucket into staging's `voice-assets` bucket via `scripts/copy-voice-assets.mjs` (bucket itself created in Phase 3 — not migration-created)
- ☐ **Vapi voice DISABLED in QA for now** (decided 2026-06-10): leave `VITE_VAPI_PUBLIC_KEY` / `VITE_VAPI_ASSISTANT_ID` **unset** in Preview scope — `useRealtimeVoice` fails soft (error state, no crash); text/Direct-LLM onboarding still works. Sharing the prod assistant is not viable: its tool webhook points at one origin (prod), so QA voice would write to prod AND look frozen in QA (Realtime arrives on staging). Vapi tools are also **org-global** — a staging assistant later needs a **separate Vapi org** + own keys, then `npm run vapi:sync -- --staging` with `VAPI_WEBHOOK_BASE_URL=https://guided-growth-qa.vercel.app` (flag + `vapi.lock.staging.json` already in place)
- **Done when:** `screen_contexts` synced, MP3s copied, Vapi vars unset in Preview. No prod→staging data copy, no anonymization; tester data is created in staging directly.

## Phase 6 — Verify + promote

**Owner:** Claude + human · **Depends:** 4, 5

- ☐ Smoke test: Google + email sign-in; onboarding (JWT hook + realtime isolation); `/api/llm`; confirm writes land in staging
- ☐ Reconcile `dual-app-handoff.md` + `ENVIRONMENTS.md` to point here for the DB split
- ☐ MR `staging → main`
- **Done when:** green QA env, docs reconciled, on `main`.

---

### Sequencing

- **Done:** Phase 1 (human) ‖ Phase 2 (Claude) — both ☑ 2026-06-10
- **Now serial:** 3 → 4 (prioritize — closes the prod-write risk) → 5 → 6
- **Approval gates:** every `db push` (3), env/dashboard wiring (4). No PII data copy; tester data is env-local.
