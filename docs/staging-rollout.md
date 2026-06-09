# Staging Environment — Rollout Checklist

Living tracker for standing up the separate staging/QA environment. Plan + rationale live in [`supabase-environments.md`](./supabase-environments.md); this is the execution checklist. Tick items as they land.

**Legend:** 🔴 critical path · 🟡 approval gate · ☐ todo · ☑ done

---

## Phase 0 — Baseline ☑

- ☑ Long-lived `staging` branch (promotion: feature → `staging` → `main`)
- ☑ QA app URL live: `https://guided-growth-qa.vercel.app` (Vercel, pinned to `staging`; prod untouched)
- ☑ Plan doc on `main` (MR !290 merged)
- ☑ Separate-staging-DB decision approved

## Phase 1 — Provision staging Supabase 🔴

**Owner:** human (dashboard) · **Gate:** none

- ☐ Create a fresh `gg-staging` Supabase project (clean — do not hand-modify)
- ☐ Record ref + DB password + anon key + service_role key (keys → Vercel/secrets, never chat/repo)
- **Done when:** project exists, ref captured. _Blocks Phases 3–5._

## Phase 2 — Code scaffolding (inert) ☑

**Owner:** Claude · **Branch:** `feat/staging-supabase-wiring` → `staging` · **Gate:** none

- ☑ `[remotes.staging]` in `supabase/config.toml` (real ref `ppyouymvnrqxcsllrmsl`)
- ☑ `.github/workflows/staging-db.yml` — `db push` to staging on push to `staging` (paths `supabase/migrations/**`); prod is manual `workflow_dispatch` + `environment: production`. INERT: both jobs no-op until repo vars `STAGING_DB_ENABLED` / `PROD_DB_ENABLED` == `'true'`.
- ☑ Catalog reference content captured as an idempotent seed migration `supabase/migrations/043_seed_catalog.sql` (`INSERT … ON CONFLICT DO NOTHING`; harmless no-op where prod already has it) — ships to every env via `db push`. No data-sync script, no prod→staging copy, no anonymization (these tables hold zero PII).
- ☑ this rollout checklist
- **Done when:** merged to `staging`; nothing executes until secrets/vars exist.

**Secrets/vars this phase introduces (set later, in Phase 4):**

- GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`, `PROD_PROJECT_REF`, `PROD_DB_PASSWORD`
- GitHub repo variables (the inert switches): `STAGING_DB_ENABLED=true`, `PROD_DB_ENABLED=true`

## Phase 3 — Apply schema to staging

**Owner:** Claude · **Depends:** Phase 1 · **Gate:** 🟡 migration approval

- ☐ `supabase link --project-ref <ref>` → `db push`
- ☐ `supabase migration list` → confirm parity with prod
- ☐ Enable Custom Access Token hook in staging dashboard
- **Done when:** staging schema == prod schema; auth hook on.

## Phase 4 — Wire env + auth 🔴 (closes the "QA writes to prod" risk)

**Owner:** human + Claude · **Depends:** Phase 1 (+3) · **Gate:** dashboard toggles

- ☐ Vercel Preview-scope env → staging: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler 6543), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_WEB_ORIGIN`
- ☐ Confirm Production scope still → prod
- ☐ Staging redirect allowlist (incl. QA URL) + Google OAuth client + Resend
- ☐ GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`
- **Done when:** QA app reads/writes **staging** DB, not prod.

## Phase 5 — Seed reference content

**Owner:** Claude · **Depends:** Phase 3 · **Gate:** none

- ☐ Catalog (`categories`/`subcategories`/`starter_habits`) lands via the `043_seed_catalog.sql` seed migration on `db push` (Phase 3) — verify the rows are present
- ☐ Staging voice-sync run for `screen_contexts`
- **Done when:** staging catalog matches prod and `screen_contexts` is synced. No prod→staging data copy, no anonymization (catalog holds zero PII); tester data is created in staging directly.

## Phase 6 — Verify + promote

**Owner:** Claude + human · **Depends:** 4, 5

- ☐ Smoke test: Google + email sign-in; onboarding (JWT hook + realtime isolation); `/api/llm`; confirm writes land in staging
- ☐ Reconcile `dual-app-handoff.md` + `ENVIRONMENTS.md` to point here for the DB split
- ☐ MR `staging → main`
- **Done when:** green QA env, docs reconciled, on `main`.

---

### Sequencing

- **Now (parallel):** Phase 1 (human) ‖ Phase 2 (Claude)
- **Then serial:** 3 → 4 (prioritize — closes the prod-write risk) → 5 → 6
- **Approval gates:** every `db push` (3), env/dashboard wiring (4). No PII data copy — catalog ships via the `043_seed_catalog.sql` seed migration, tester data is env-local.
