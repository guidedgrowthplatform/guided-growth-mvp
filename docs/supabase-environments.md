# Environments — Staging (QA) + Production

How Guided Growth runs two environments: **production** (live users) and **staging/QA** (a safe copy for testing). Each has its own Supabase project and its own app URL. **Schema is kept identical via migrations** (`db push`). The onboarding **catalog** is **code-side**, not in the DB, so it's identical by construction; the one piece of DB-resident reference content, `screen_contexts`, is kept in sync via voice-sync (see §8). The only env-specific data is what testers create. **No prod→staging data copying.**

- **Production project ref:** `pmunbflbjpoawicgimyc`
- **Staging project ref:** `ppyouymvnrqxcsllrmsl` (created 2026-06-10)
- **Production app:** live site on `main`
- **Staging/QA app:** `https://guided-growth-qa.vercel.app` — **live**, pinned to the `staging` branch (Vercel → Domains, Preview + branch `staging`). Stable fallback alias: `https://guided-growth-mvp-git-staging-guided-growths-projects.vercel.app`.
- **Caveat (until §4 done):** the QA app currently runs on the **Preview-scope env vars, which still point at the prod Supabase** — so QA writes land in prod until a separate staging project is provisioned and wired. Not for tester data-entry yet.

> **Decided — separate staging environment is approved** (Yair + team), superseding the 2026-06-06 shared-backend stance in `docs/dual-app-handoff.md` (QA shares prod, account-isolated). `docs/ENVIRONMENTS.md` already assumes a per-stage `staging` Supabase project — this doc is the backend half of that. Follow-up: reconcile the two older docs to point here for the database split.

---

## 1. The model (branch → app → database)

Two stable environments plus throwaway previews, keyed off git branch. Vercel deploys each; each talks to its own database.

```
feature branch → MR → merge to `staging`
        → QA app (gg-staging.vercel.app, STAGING db) rebuilds → testers verify
        → merge `staging` → `main`
        → live app (prod db) rebuilds
```

| Branch     | Vercel deployment                          | Database                |
| ---------- | ------------------------------------------ | ----------------------- |
| `main`     | Live app (production)                      | **Production** Supabase |
| `staging`  | **QA app** — one stable `*.vercel.app` URL | **Staging** Supabase    |
| feature/\* | Throwaway preview link (per-MR)            | Staging Supabase        |

Principles:

- **One Vercel project**, not two. The `staging` branch gets a pinned stable domain so testers always use the same link.
- **No environment branching in code.** Which database the app uses is decided purely by which branch built it, via per-scope env-var _values_ (§7).
- **Promotion is a normal merge.** `staging` → `main` ships tested work to production.
- **Schema syncs continuously** (same migration files pushed to both projects). The onboarding **catalog** is code-side, identical across envs by construction; `screen_contexts` (the one DB-resident reference table) syncs via voice-sync. **The only env-specific data is what testers create** — no prod→staging copying.

---

## 2. Decision: two independent Supabase projects (not Branching)

|                | Two independent projects (chosen)                              | Supabase Branching                                  |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Staging URL    | Stable, permanent                                              | Churns (preview) / per-branch billing (persistent)  |
| Schema sync    | Our existing CLI migration flow, verbatim                      | Git-integration driven (GitHub-tuned)               |
| Edge Functions | N/A — we have none                                             | Auto-deploy per branch (its headline win)           |
| Data           | Onboarding catalog is code-side; `screen_contexts` synced via voice-sync; tester data env-local | Same — schema/content via migration, tester data env-local |
| Git trigger    | Plain `db push` per ref, any host                              | Auto-creates branches from **GitHub** PRs           |

We use **two independent projects** because migrations are already CLI-driven, we have zero Edge Functions, and we want a stable staging URL. Branching's auto-branch-on-PR is keyed to GitHub PRs, but our code + MRs live on **GitLab** (GitHub only hosts the CI workflows), so that trigger wouldn't fire from our flow anyway.

---

## 3. Stable QA app on Vercel

A permanent QA URL testers use every day, fed by the `staging` branch — not Vercel's throwaway per-MR previews. **Done:** `guided-growth-qa.vercel.app` is live on `staging`.

How it was set up (Vercel → **Domains** — not under Settings):

- **Same Vercel project** (`guided-growth-mvp`); free `*.vercel.app` subdomain, no DNS, no purchase.
- **Add Existing** → `guided-growth-qa.vercel.app` → **Connect to an environment: Preview** → branch **`staging`** → Add Domain. Left the prod row (`guided-growth-mvp.vercel.app → Production`) untouched.
- **Gotcha:** a domain freshly connected to a Preview branch may **404 until the next deployment to that branch** — it doesn't retroactively alias the existing one. Push any commit to `staging` (or redeploy) and it starts serving. The auto alias `…-git-staging-…vercel.app` serves immediately in the meantime.
- **Custom subdomain later** (e.g. `qa.guidedgrowthapp.com`) is the same flow with a domain you own (needs DNS). Not required.

---

## 4. Supabase setup

> **APPROVAL GATES inline.** Do not run a migration or flip a dashboard toggle without explicit go-ahead.

**Step 1 — Provision a fresh staging project [dashboard].**
Create `gg-staging`. Use a **clean** project — do NOT clone/hand-modify, or `db push` conflicts re-applying migrations. Record: project ref, DB password, URL, anon key, service_role key.

**Step 2 — Auth the CLI.** `supabase login` (sets `SUPABASE_ACCESS_TOKEN`; also into CI secrets).

**Step 3 — Migrations are the single source of truth.** `supabase/migrations/*.sql` stay byte-identical across both refs.

**Step 4 — Link on demand (one ref at a time).** Drive from CI with `--project-ref`:

```bash
supabase db reset                       # local rebuild from migrations + seed.sql

# staging  [APPROVAL REQUIRED before push]
supabase link --project-ref <STAGING_REF>
supabase db push
supabase migration list                 # confirm parity

# prod (unchanged from today)
supabase link --project-ref pmunbflbjpoawicgimyc
supabase db push
```

**Step 5 — Per-env override in `config.toml`.** Add a `[remotes.staging]` block; keep the existing custom-access-token hook.

```toml
[remotes.staging]
project_id = "<STAGING_REF>"
```

**Step 6 — JWT/auth hook on staging [APPROVAL + dashboard].** After `db push`, confirm **Auth → Hooks → Custom Access Token** points at `pg-functions://postgres/public/custom_access_token_hook`. Each project has its own `auth.users` + JWT secret.

---

## 5. Mirroring schema and reference content

Both the schema **and** the reference content (the catalog) come from migrations. There is **no prod→staging data copying, no data-sync script, and no anonymization** — the catalog tables hold zero PII, and tester data stays env-local.

### Schema + reference content — continuous, via CLI

Identical migration files → `db push` to both refs (idempotent → converges). **Never hand-edit schema or reference rows in a dashboard.** Catch drift:

```bash
supabase db diff --linked    # detect drift on the linked ref
supabase db pull             # roundtrip an unmanaged change into a new migration
```

### Catalog — no DB seed (lives in code)

There is **no catalog seed migration.** The `categories` / `subcategories` / `starter_habits` tables are created by `001_onboarding.sql` but are **empty in prod and read by nothing** — the live onboarding taxonomy is code-side (`src/data/onboardingHabits.ts` → `@gg/shared/data/onboardingGoals` + `onboardingHabits`), bundled into both app builds. So staging needs no catalog data load; it ships the same taxonomy via the same code.

(An earlier `043_seed_catalog.sql` seed + `scripts/export-catalog-seed.mjs` were dropped — they sourced empty rows from empty prod tables to seed vestigial tables. The DB-vs-code catalog split is a separate cleanup question, out of scope here.)

### Tester data — env-local, never copied

Whatever testers create in staging lives only in staging. No dump, no anonymization, no restore step.

---

## 6. Per-environment config

### Env vars — same names, different values per Vercel scope

| Var                         | Read in                                                                             | Per-env action                              |
| --------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `VITE_SUPABASE_URL`         | `src/lib/supabase.ts`; `src/lib/config/voice.ts`                                    | Staging URL in Preview build (build-time)   |
| `VITE_SUPABASE_ANON_KEY`    | `src/lib/supabase.ts`                                                               | Staging anon key in Preview build           |
| `SUPABASE_URL`              | `api/_lib/supabase-admin.ts`, `api/_lib/supabase.ts`, `api/onboarding/[...path].ts` | Staging URL in Preview scope                |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib/supabase-admin.ts`, `api/_lib/supabase.ts`                                | **Staging** service role in Preview (§9 #1) |
| `DATABASE_URL`              | `api/_lib/db.ts` (pg.Pool)                                                          | Staging **pooler** string (6543) in Preview |
| `SUPABASE_SSL_CERT`         | `api/_lib/db.ts`                                                                    | Staging cert if used                        |
| `VITE_PUBLIC_WEB_ORIGIN`    | `src/lib/env.ts` (`getWebOrigin`, used in `authStore.ts`)                           | Staging web origin in Preview build         |

Same variable names; the _values_ differ per Vercel scope. No `SUPABASE_PROJECT_ENV`-style branching in code.

### Auth allowlist — staging dashboard (not version-controlled)

Staging's own Site URL + redirect allowlist (mirror CLAUDE.md with staging hosts):

- `https://<staging>.vercel.app/auth/callback`, `https://*.vercel.app/auth/callback`
- `http://localhost:5173/auth/callback`, `http://localhost:3000/auth/callback`
- `guidedgrowth://auth/callback`, `guidedgrowth://auth/handoff`

Plus per-project: a **Google OAuth client** for staging (add its callback to the OAuth client's redirect URIs); each project's **own JWT secret** (never copy across); replicated **email templates + Resend sender** (`mail.guidedgrowthapp.com`).

### CSP — no change needed

`index.html` and `vercel.json` already wildcard `https://*.supabase.co` / `wss://*.supabase.co`. `connect-src` lives in **both** files — if ever narrowed to a specific host, edit both.

---

## 7. Vercel env wiring

Same variable names, different scopes. Production scope → `main` (prod DB); Preview scope → `staging` branch + all feature previews (staging DB). Two consumers need values, in two different places:

### (A) Vercel Preview scope — web QA + API runtime

Set each `preview`-scoped to staging values (prod-scoped to prod). Without the voice/LLM/email keys, QA's text/Direct-LLM onboarding 500s.

- **Supabase/DB:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler 6543), `SUPABASE_SSL_CERT` (decide per-env), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_WEB_ORIGIN`.
- **Voice/LLM:** `OPENAI_API_KEY`, `SONIOX_API_KEY`, `CARTESIA_API_KEY`.
- **Email:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FEEDBACK_ALERT_TO`.
- **Analytics:** `VITE_POSTHOG_KEY` (separate staging project), `VITE_POSTHOG_HOST`.
- **Sentry:** separate QA `VITE_SENTRY_DSN`/`SENTRY_DSN`, or `VITE_SENTRY_ENVIRONMENT=staging` + `SENTRY_ENVIRONMENT=staging` to tag a shared DSN.
- **`QA_RESET_TOKEN`** — ⚠️ `api/qa-reset.ts` is a destructive reset authed only by this token, writing via `DATABASE_URL`. A Preview deploy still pointed at prod `DATABASE_URL` would **wipe prod** — only set once Preview `DATABASE_URL` is staging.
- **Do NOT set in Preview:** `VITE_VAPI_*` (QA voice off), `VAPI_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `PUSH_CRON_ENABLED`, `CRON_SECRET`, `GITLAB_TOKEN`/`GITLAB_PROJECT_ID`. `AUTH_BYPASS_MODE` is inert anyway (gated on `NODE_ENV!=='production'`).

### (B) GitHub `staging` Environment — native QA build-time

`VITE_*` are **baked at build**; Vercel env never reaches the native bundle. The native QA build (`cap sync`/`vite build`) needs them in the GitHub `staging` Environment: all `VITE_*` above + `VITE_API_URL=https://guided-growth-qa.vercel.app` + `CAP_EXTRA_NAV_HOSTS=ppyouymvnrqxcsllrmsl.supabase.co`.

**JWT-issuer rule:** client `VITE_SUPABASE_URL` and server `SUPABASE_URL` must be the same project, or every API call fails JWT verification. **Redeploy after any env change** — existing deployments don't pick up new values.

---

## 8. Ongoing-sync workflow (GitHub Actions)

Active CI runs on **GitHub Actions** (`.github/workflows/` — `ci.yml`, `voice-sync.yml` hourly, `qa-release.yml`, `match-bootstrap.yml`). The repo + MRs live on **GitLab**, mirrored to GitHub for Actions. The root `.gitlab-ci.yml` voice-sync job is disabled (`rules: when: never`) — add new automation as GitHub workflows, not there.

- **On MR:** `supabase db start` → apply migrations to an ephemeral local DB → optionally regenerate types and fail on uncommitted diff. No remote push.
- **On push to `staging`:** runs `db push --dry-run` only (prints the plan, never applies). A real apply is a deliberate `workflow_dispatch` with `dry_run=false`, gated by the `staging` Environment. Staging voice-sync for `screen_contexts` is separate. No data refresh — there is none.
- **On `main`:** same `db push` but a **MANUAL `workflow_dispatch` job, never auto-on-push** [APPROVAL REQUIRED].

GitHub Actions secrets (never in repo): `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`, plus prod equivalents.

```yaml
# .github/workflows/staging-db.yml (illustrative — see the real file for full gating)
# Push to `staging` runs db push --DRY-RUN only; a real apply is a manual
# workflow_dispatch (dry_run=false) gated by `environment: staging`.
on:
  push:
    branches: [staging]
  workflow_dispatch:
    inputs: { dry_run: { type: boolean, default: true } }
jobs:
  push-staging:
    runs-on: ubuntu-latest
    environment: staging
    if: vars.STAGING_DB_ENABLED == 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v2
      - run: |
          supabase link --project-ref "$STAGING_PROJECT_REF"
          # push events force dry-run; only an explicit dispatch can apply
          [ "$DRY_RUN" = "true" ] && supabase db push --dry-run || supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          STAGING_PROJECT_REF: ${{ secrets.STAGING_PROJECT_REF }}
          SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
          DRY_RUN: ${{ github.event_name == 'push' && 'true' || github.event.inputs.dry_run }}
# prod: a separate workflow_dispatch (manual) job with prod secrets — never on: push to main
```

---

## 9. Codebase gotchas

1. **Service-role bypasses RLS (gotcha #5) — env routing IS the security boundary.** A misrouted `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` (prod value in Preview scope) silently makes staging code read/write prod data. Audit that staging's service_role differs from prod's and is wired only to Preview. Never expose service_role to the client bundle.
2. **Realtime DOES enforce RLS (gotcha #9).** `onboarding_states` `user_isolation` policy must exist on staging — verify the RLS migrations pushed cleanly.
3. **Pooler vs direct (gotcha #4).** Runtime `DATABASE_URL` = staging **pooler** (6543, transaction mode). Migrations / `db push` / `psql -f` restore = staging **DIRECT** connection (5432) — DDL through the pooler breaks.
4. **`VITE_PUBLIC_WEB_ORIGIN` must be set for staging.** `authStore.ts` builds the OAuth callback from `getWebOrigin()`; staging builds must inject the staging origin. OAuth allowlist + Google redirect URIs are dashboard-only.
5. **voice-sync seed targets ONE project.** `scripts/voice-sync/seed_contexts.py` reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; `.github/workflows/voice-sync.yml` runs hourly against prod. Add a **second** CI run with staging secrets — do NOT repoint the hourly job. Upsert is keyed on `screen_id` (idempotent).
6. **Custom access token hook** must be applied AND enabled (dashboard) on **both** projects; SQL migrations alone don't flip the toggle on a fresh project.
7. **Perf/debug scripts** (`scripts/perf-*.mjs`, `scripts/check-cadences.mjs`) read `DATABASE_URL` directly — point them at staging via env when testing there.
8. **Vapi voice is DISABLED in QA for now** (2026-06-10). A Vapi assistant's tool webhook can point at only **one** origin (prod), and Vapi tools are **org-global** — syncing a second assistant inside the prod org would repoint the prod tools' URLs. Decision: leave `VITE_VAPI_PUBLIC_KEY` / `VITE_VAPI_ASSISTANT_ID` **unset** in Preview scope (`useRealtimeVoice` fails soft; text/Direct-LLM onboarding unaffected). Later: dedicated staging assistant in a **separate Vapi org**, synced via `npm run vapi:sync -- --staging` with `VAPI_WEBHOOK_BASE_URL=https://guided-growth-qa.vercel.app`.
9. **PostHog is split per env.** Separate staging PostHog project; its key goes in `VITE_POSTHOG_KEY` in the Preview scope so QA traffic never pollutes prod analytics.
10. **`voice-assets` Storage bucket is NOT migration-created.** Create it manually in the staging dashboard, then copy the MP3s from the prod bucket via `scripts/copy-voice-assets.mjs`.

---

## 10. Checklist

1. Create the long-lived **`staging` branch** off `main`; push to `origin` to make it buildable.
2. **[dashboard]** Create a _fresh_ `gg-staging` Supabase project; record ref, DB password, URL, anon + service_role keys.
3. In Vercel (same project): pin a stable `*.vercel.app` domain to the `staging` branch → the QA app URL (§3).
4. `supabase login`; stash `SUPABASE_ACCESS_TOKEN` + `STAGING_PROJECT_REF` + `STAGING_DB_PASSWORD` as GitHub Actions secrets.
5. Add `[remotes.staging]` to `supabase/config.toml`.
6. **[approval]** `supabase link --project-ref <STAGING_REF> && supabase db push`; `supabase migration list` to confirm parity.
7. **[dashboard]** On staging: enable Custom Access Token hook; set Site URL + redirect allowlist (include the QA app URL); configure Google OAuth client + redirect URIs; replicate email templates + Resend sender.
8. **[Vercel]** Add Preview-scope env vars → staging (`DATABASE_URL` = staging **pooler**). Confirm Production scope still → prod.
9. Add a staging voice-sync CI run; leave the hourly prod job untouched.
10. Onboarding catalog is code-side (not in the DB) — identical across envs by construction, no data load or anonymization. Tester data is created in staging directly.
11. Add GitHub Actions workflows: `db push --dry-run` on push to `staging` (apply via manual dispatch, `environment: staging`); **manual** (`workflow_dispatch`) `db push` for prod.
12. Add an "Environments" note to `CLAUDE.md`/`HANDOFF.md` naming both refs + the QA app URL.
13. Smoke test staging: Google + email sign-in, an onboarding session (JWT hook + realtime isolation), a `/api/llm` call; confirm writes land in **staging**, not prod.

**Approval gates:** every `db push` (migrations), and all staging dashboard toggles (auth hook, allowlist, OAuth). There is no prod→staging data copy.
