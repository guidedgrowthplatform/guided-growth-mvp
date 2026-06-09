# Environments — Staging (QA) + Production

Plan for running a stable **staging/QA environment** (its own app URL + its own Supabase project) alongside **production**, and keeping them mirrored. Status: **proposal — nothing below has been executed.** Every `db push`, dashboard toggle, and data copy is gated on explicit human approval.

- **Production project ref:** `pmunbflbjpoawicgimyc`
- **Staging project ref:** _TBD — create per §3 Step 1_
- **Production app:** live site on `main`
- **Staging/QA app:** stable `*.vercel.app` URL (e.g. `gg-staging.vercel.app`) on the `staging` branch — _exact name TBD_

---

## 0. The big picture (branch → app → database)

Three stable environments, keyed off git branch. Vercel deploys each; each talks to its own database.

```
feature branch → MR → merge to `staging`
        → QA app (gg-staging.vercel.app, PRACTICE db) rebuilds → testers verify
        → merge `staging` → `main`
        → live app (real db) rebuilds
```

| Branch     | Vercel deployment                          | Database                        |
| ---------- | ------------------------------------------ | ------------------------------- |
| `main`     | Live app (production)                      | **Production** Supabase         |
| `staging`  | **QA app** — one stable `*.vercel.app` URL | **Staging** Supabase (practice) |
| feature/\* | Throwaway preview link (per-MR)            | Staging Supabase (practice)     |

Key points:

- **One Vercel project**, not two. The `staging` branch gets a **pinned stable domain** (the QA URL) so testers always use the same link — unlike Vercel's default per-MR preview URLs, which churn.
- **No "am I staging?" code.** Which database the app uses is decided purely by which branch built it, via per-scope env var _values_ (§5).
- **Promotion = a normal merge.** `staging` → `main` ships tested work to production.

See §7 for the CI/branch automation that drives this.

---

## 1. Decision: two independent Supabase projects (not Branching)

Two approaches were considered:

|                | (A) Two independent projects              | (B) Supabase Branching                             |
| -------------- | ----------------------------------------- | -------------------------------------------------- |
| Staging URL    | Stable, permanent                         | Churns (preview) / per-branch billing (persistent) |
| Schema sync    | Our existing CLI migration flow, verbatim | Git-integration driven (GitHub-tuned)              |
| Edge Functions | N/A — we have none                        | Auto-deploy per branch (its headline win)          |
| Data           | Manual dump + anonymize                   | Still manual dump + anonymize                      |
| CI fit         | Works with our GitLab CI                  | Tuned for GitHub                                   |

**Chosen: (A) two independent projects**, because:

- We need a **stable staging URL** to wire into Vercel Preview + native `VITE_PUBLIC_WEB_ORIGIN` and the OAuth redirect allowlist.
- Migrations are **already CLI-driven** (numbered files in `supabase/migrations/`) — two refs reuse the flow with zero change.
- We have **zero Supabase Edge Functions**, so Branching's main advantage doesn't apply.
- CI is **GitLab**, not the GitHub integration Branching targets.

Branching _preview_ branches can be layered later for throwaway per-PR DBs — additive, not the staging tier.

---

## 2. Stable QA app on Vercel (the deployment side)

Goal: a **permanent QA URL** testers use every day, fed by the `staging` branch — not Vercel's throwaway per-MR previews.

- **Chosen:** same Vercel project, a fixed `*.vercel.app` domain (e.g. `gg-staging.vercel.app`) pinned to the `staging` branch. No DNS work; swap to a custom subdomain later without touching anything else.
- **How:** Vercel project → Settings → Domains → add the chosen `*.vercel.app` domain and assign it to the **`staging` Git branch**. Every merge into `staging` rebuilds that same URL.
- **Branch model:** create a long-lived `staging` branch off `main`. MRs target `staging`; promotion to production is a `staging` → `main` merge.
- **Why one project, not two:** less to maintain at our size; per-scope env values (§5) already give full database isolation.

> Decision still open only if you later want a custom subdomain (e.g. `qa.guidedgrowthapp.com`) — needs a DNS record. Not required now.

---

## 3. Supabase setup steps

> **APPROVAL GATES are flagged inline.** Do not run any migration or flip any dashboard toggle without explicit go-ahead.

**Step 1 — Provision a fresh staging project [human, dashboard].**
Create `gg-staging` in the Supabase dashboard. Use a **clean** project — do NOT clone/hand-modify it, or `db push` conflicts when re-applying migrations. Record: project ref, DB password, URL, anon key, service_role key.

**Step 2 — Auth the CLI.** `supabase login` (sets `SUPABASE_ACCESS_TOKEN`; also goes into CI secrets).

**Step 3 — Migrations stay the single source of truth.** `supabase/migrations/*.sql` stay byte-identical across both refs. Nothing about the files changes.

**Step 4 — Link on demand (one ref at a time).** Don't keep two `supabase/` dirs. Drive from CI with `--project-ref`:

```bash
supabase db reset                      # local rebuild from migrations + seed.sql

# staging  [APPROVAL REQUIRED before push]
supabase link --project-ref <STAGING_REF>
supabase db push
supabase migration list                # confirm parity

# prod (unchanged from today)
supabase link --project-ref pmunbflbjpoawicgimyc
supabase db push
```

**Step 5 — Per-env override in `config.toml`.** Add a `[remotes.staging]` block; keep the existing custom-access-token hook declaration.

```toml
[remotes.staging]
project_id = "<STAGING_REF>"
# optional staging-only seed:
# [remotes.staging.db.seed]
# sql_paths = ["./supabase/seeds/staging-seed.sql"]
```

**Step 6 — JWT/auth hook on staging [APPROVAL REQUIRED + dashboard].** After `db push`, confirm in the staging dashboard that **Auth → Hooks → Custom Access Token** points at `pg-functions://postgres/public/custom_access_token_hook`. Each project has its own `auth.users` + JWT secret — correct isolation.

---

## 4. Mirroring schema and data

### Schema — continuous, via CLI (already our workflow)

Identical migration files → `db push` to both refs (idempotent → converges). **Never hand-edit schema in a dashboard.** Catch drift:

```bash
supabase db diff --linked    # detect drift on the linked ref
supabase db pull             # roundtrip an unmanaged change into a new migration
```

### Data — periodic anonymized snapshot (NOT a continuous stream)

```bash
# schema-only
supabase db dump --linked -f supabase/schema.sql

# data-only, EXCLUDING PII-heavy tables
supabase db dump --linked --data-only --use-copy \
  --exclude public.chat_messages,public.admin_audit_log \
  -f data.sql

# restore into staging via its DIRECT connection (5432, NOT the pooler)
psql -d "<STAGING_DIRECT_DB_URL>" -f data.sql
```

### PII / anonymization — NON-NEGOTIABLE before prod → staging

`chat_messages` stores **unscrubbed onboarding text** (real nickname/age/referral/brain-dump — CLAUDE.md gotcha #8). Must not be cloned verbatim into lower-trust staging. Either:

- **Exclude + synthesize** — drop `chat_messages` from the dump, re-seed synthetic rows; or
- **Dump → anonymize → load** — load to a scratch DB, `UPDATE chat_messages SET content = <faker/hash>`, then load into staging.

Schema syncs continuously via migrations; **data is only ever periodic anonymized snapshots.**

---

## 5. Per-environment config to duplicate

### Env vars — same names, different values per Vercel scope

| Var                         | Read in                                                                             | Per-env action                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | `src/lib/supabase.ts`; `src/lib/config/voice.ts`                                    | Staging URL in Preview build (baked at build time)                                 |
| `VITE_SUPABASE_ANON_KEY`    | `src/lib/supabase.ts`                                                               | Staging anon key in Preview build                                                  |
| `SUPABASE_URL`              | `api/_lib/supabase-admin.ts`, `api/_lib/supabase.ts`, `api/onboarding/[...path].ts` | Staging URL in Preview scope                                                       |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib/supabase-admin.ts`, `api/_lib/supabase.ts`                                | **Staging** service role in Preview — wrong value = staging code on prod data (§8) |
| `DATABASE_URL`              | `api/_lib/db.ts` (pg.Pool)                                                          | Staging **pooler** string (6543) in Preview                                        |
| `SUPABASE_SSL_CERT`         | `api/_lib/db.ts`                                                                    | Staging cert if used                                                               |
| `VITE_PUBLIC_WEB_ORIGIN`    | `src/stores/authStore.ts`                                                           | Staging web origin in Preview/native-staging build                                 |

**No conditional code.** The variable _values_ differ per Vercel scope; same names resolve to staging in Preview, prod in Production. Do NOT add `SUPABASE_PROJECT_ENV`-style branching.

### Auth allowlist — staging dashboard, NOT version-controlled

Staging's own Site URL + redirect allowlist (mirror CLAUDE.md with staging hosts):

- `https://<staging>.vercel.app/auth/callback`, `https://*.vercel.app/auth/callback`
- `http://localhost:5173/auth/callback`, `http://localhost:3000/auth/callback`
- `guidedgrowth://auth/callback`, `guidedgrowth://auth/handoff`

Plus per-project (not carried by SQL):

- **Google OAuth client** — separate client for staging; add the staging callback to its authorized redirect URIs. _[decision: separate vs shared — separate keeps isolation.]_
- **JWT secret** — each project's own; never copy across.
- **Email templates + sender** — replicate; confirm Resend sender `mail.guidedgrowthapp.com` works for staging (apex not verified).

### CSP — no change needed

`index.html` and `vercel.json` already wildcard `https://*.supabase.co` / `wss://*.supabase.co`. **But `connect-src` lives in BOTH `index.html` meta and `vercel.json`** — if ever narrowed from wildcard to a specific host, edit both.

---

## 6. Vercel env wiring (staging/preview vs production)

**Same variable names, different scopes.** Production scope → `main` (real DB); Preview scope covers the `staging` branch **and** every feature preview (practice DB).

```bash
# Production scope → prod ref
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add DATABASE_URL production
# + VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_PUBLIC_WEB_ORIGIN production

# Preview scope → STAGING ref
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add DATABASE_URL preview
# + staging VITE_* + VITE_PUBLIC_WEB_ORIGIN preview
```

Preview → staging, Production → prod. `VITE_*` are **baked at build time**, so a Preview build must receive staging `VITE_*` values, a Production build the prod ones. One Supabase project per build — cannot mix. The stable QA app (§2) is just the `staging` branch's deployment, so it inherits the Preview-scope values automatically.

---

## 7. Ongoing-sync workflow (GitLab CI)

- **On MR:** `supabase db start` → apply migrations to an ephemeral local DB → optionally regenerate types and fail on uncommitted diff. No remote push.
- **On merge to `staging` branch:** `supabase link --project-ref $STAGING_PROJECT_ID && supabase db push`. Then staging voice-sync (§8) and, on a separate cron, the anonymized data refresh (§4).
- **On merge to `main` → prod:** same `db push` but a **MANUAL job, never auto-on-merge** [APPROVAL REQUIRED].

CI variables (secrets only, never in repo): `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_ID`, `STAGING_DB_PASSWORD`, plus prod equivalents.

```yaml
# .gitlab-ci.yml sketch — staging stage
deploy_staging_db:
  rules: [{ if: '$CI_COMMIT_BRANCH == "staging"' }]
  variables:
    SUPABASE_ACCESS_TOKEN: $SUPABASE_ACCESS_TOKEN
    SUPABASE_DB_PASSWORD: $STAGING_DB_PASSWORD
  script:
    - supabase link --project-ref $STAGING_PROJECT_ID
    - supabase db push
# prod stage: same, when: manual, prod variables
```

---

## 8. Codebase-specific gotchas

1. **Service-role bypasses RLS (gotcha #5) — env routing IS the security boundary.** A misrouted `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` (prod value in Preview scope) silently makes staging code read/write prod data. RLS won't save you. Audit that staging's service_role differs from prod's and is wired only to Preview. Never expose service_role to the Vite client bundle.
2. **Realtime DOES enforce RLS (gotcha #9).** `onboarding_states` `user_isolation` policy must exist on staging — verify the RLS migrations pushed cleanly or realtime isolation silently fails.
3. **`pg.Pool max:1` + pooler vs direct (gotcha #4).** Runtime `DATABASE_URL` must be the staging **pooler** (Supavisor, 6543, transaction mode). But **migrations / `db push` / `psql -f` restore must use the staging DIRECT connection (5432)** — DDL through the transaction pooler breaks.
4. **Redirect URLs are dynamic but `VITE_PUBLIC_WEB_ORIGIN` must be set for staging.** `authStore.ts` builds the callback from `getWebOrigin()`; staging builds must inject the staging origin or OAuth handoff breaks. OAuth allowlist + Google redirect URIs are dashboard-only.
5. **voice-sync seed targets ONE project.** `scripts/voice-sync/seed_contexts.py` reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; `.github/workflows/voice-sync.yml` runs hourly against prod. Add a **second** CI run with staging secrets — do NOT repoint the existing hourly job. Upsert keyed on `screen_id` (idempotent). Same applies to seed SQL — both projects need identical seed in the same order.
6. **Custom access token hook** must be applied AND enabled (dashboard) on **both** projects; SQL migrations alone don't flip the auth-hook toggle on a fresh project.
7. **Docs name the prod ref explicitly** (`CLAUDE.md`, `HANDOFF.md`). This "Environments" doc disambiguates — keep both refs (and the QA app URL) named at the top.
8. **Perf/debug scripts** (`scripts/perf-*.mjs`, `scripts/check-cadences.mjs`) read `DATABASE_URL` directly — point them at staging via env when testing there.

---

## 9. "Do this first" checklist

1. **[decision]** Create a _fresh_ `gg-staging` Supabase project; record ref, DB password, URL, anon + service_role keys. Don't hand-modify it.
2. Create the long-lived **`staging` branch** off `main`.
3. In Vercel (same project): pin a stable `*.vercel.app` domain (e.g. `gg-staging.vercel.app`) to the `staging` branch → that's the QA app URL.
4. `supabase login`; stash `SUPABASE_ACCESS_TOKEN` + `STAGING_PROJECT_ID` + `STAGING_DB_PASSWORD` in GitLab CI variables.
5. Add `[remotes.staging]` to `supabase/config.toml`.
6. **[approval]** `supabase link --project-ref <STAGING_REF> && supabase db push`; `supabase migration list` to confirm parity.
7. **[dashboard]** On staging: enable Custom Access Token hook; set Site URL + redirect allowlist (include the QA app URL); configure Google OAuth client + redirect URIs; replicate email templates + Resend sender.
8. **[Vercel]** Add Preview-scope env vars → staging (`DATABASE_URL` = staging **pooler**). Confirm Production scope still → prod.
9. Add a staging voice-sync CI run; leave the hourly prod job untouched.
10. **[approval]** Initial data load: dump prod excluding `chat_messages`/`admin_audit_log`, anonymize, restore into staging via **direct** (5432); re-seed synthetic onboarding rows.
11. Add GitLab CI stages: auto `db push` on `staging`, **manual** `db push` for prod.
12. Add an "Environments" note to `CLAUDE.md`/`HANDOFF.md` naming both refs + the QA app URL.
13. Smoke test staging: Google + email sign-in, an onboarding session (JWT hook + realtime isolation), a `/api/llm` call; confirm via the staging dashboard that writes land in **staging**, not prod.

**Approval gates for the human:** every `db push` (migrations), all staging dashboard toggles (auth hook, allowlist, OAuth), and the prod→staging data copy (PII).
