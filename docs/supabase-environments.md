# Environments — Staging (QA) + Production

How Guided Growth runs two environments: **production** (live users) and **staging/QA** (a safe copy for testing). Each has its own Supabase project and its own app URL. Schema is kept identical via migrations; staging data is periodic anonymized snapshots of prod.

- **Production project ref:** `pmunbflbjpoawicgimyc`
- **Staging project ref:** _TBD — created in §4 Step 1_
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
- **Schema syncs continuously** (same migration files pushed to both projects); **data is periodic anonymized snapshots**, never a live stream.

---

## 2. Decision: two independent Supabase projects (not Branching)

|                | Two independent projects (chosen)         | Supabase Branching                                 |
| -------------- | ----------------------------------------- | -------------------------------------------------- |
| Staging URL    | Stable, permanent                         | Churns (preview) / per-branch billing (persistent) |
| Schema sync    | Our existing CLI migration flow, verbatim | Git-integration driven (GitHub-tuned)              |
| Edge Functions | N/A — we have none                        | Auto-deploy per branch (its headline win)          |
| Data           | Manual dump + anonymize                   | Still manual dump + anonymize                      |
| Git trigger    | Plain `db push` per ref, any host         | Auto-creates branches from **GitHub** PRs          |

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

## 5. Mirroring schema and data

### Schema — continuous, via CLI

Identical migration files → `db push` to both refs (idempotent → converges). **Never hand-edit schema in a dashboard.** Catch drift:

```bash
supabase db diff --linked    # detect drift on the linked ref
supabase db pull             # roundtrip an unmanaged change into a new migration
```

### Data — periodic anonymized snapshot

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

**PII — non-negotiable before prod → staging.** `chat_messages` stores unscrubbed onboarding text (real nickname/age/referral/brain-dump — CLAUDE.md gotcha #8). Either **exclude + synthesize** (drop it, re-seed synthetic rows) or **dump → anonymize → load** (`UPDATE chat_messages SET content = <faker/hash>`).

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

Same variable names, different scopes. Production scope → `main` (prod DB); Preview scope → `staging` branch + all feature previews (staging DB).

```bash
# Production scope → prod ref
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add DATABASE_URL production
# + VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_PUBLIC_WEB_ORIGIN production

# Preview scope → staging ref
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add DATABASE_URL preview
# + staging VITE_* + VITE_PUBLIC_WEB_ORIGIN preview
```

`VITE_*` are baked at build time, so a Preview build must receive staging values, a Production build prod values. One project per build — cannot mix. The stable QA app is just the `staging` branch's deployment, so it inherits the Preview-scope values.

---

## 8. Ongoing-sync workflow (GitHub Actions)

Active CI runs on **GitHub Actions** (`.github/workflows/` — `ci.yml`, `voice-sync.yml` hourly, `qa-release.yml`, `match-bootstrap.yml`). The repo + MRs live on **GitLab**, mirrored to GitHub for Actions. The root `.gitlab-ci.yml` voice-sync job is disabled (`rules: when: never`) — add new automation as GitHub workflows, not there.

- **On MR:** `supabase db start` → apply migrations to an ephemeral local DB → optionally regenerate types and fail on uncommitted diff. No remote push.
- **On push to `staging`:** `supabase link --project-ref $STAGING_PROJECT_ID && supabase db push`, then staging voice-sync and (separate schedule) the anonymized data refresh.
- **On `main`:** same `db push` but a **MANUAL `workflow_dispatch` job, never auto-on-push** [APPROVAL REQUIRED].

GitHub Actions secrets (never in repo): `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_ID`, `STAGING_DB_PASSWORD`, plus prod equivalents.

```yaml
# .github/workflows/staging-db.yml — apply migrations to staging on push to `staging`
on:
  push:
    branches: [staging]
jobs:
  deploy_staging_db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref "$STAGING_PROJECT_ID" && supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          STAGING_PROJECT_ID: ${{ secrets.STAGING_PROJECT_ID }}
          SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
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

---

## 10. Checklist

1. Create the long-lived **`staging` branch** off `main`; push to `origin` to make it buildable.
2. **[dashboard]** Create a _fresh_ `gg-staging` Supabase project; record ref, DB password, URL, anon + service_role keys.
3. In Vercel (same project): pin a stable `*.vercel.app` domain to the `staging` branch → the QA app URL (§3).
4. `supabase login`; stash `SUPABASE_ACCESS_TOKEN` + `STAGING_PROJECT_ID` + `STAGING_DB_PASSWORD` as GitHub Actions secrets.
5. Add `[remotes.staging]` to `supabase/config.toml`.
6. **[approval]** `supabase link --project-ref <STAGING_REF> && supabase db push`; `supabase migration list` to confirm parity.
7. **[dashboard]** On staging: enable Custom Access Token hook; set Site URL + redirect allowlist (include the QA app URL); configure Google OAuth client + redirect URIs; replicate email templates + Resend sender.
8. **[Vercel]** Add Preview-scope env vars → staging (`DATABASE_URL` = staging **pooler**). Confirm Production scope still → prod.
9. Add a staging voice-sync CI run; leave the hourly prod job untouched.
10. **[approval]** Initial data load: dump prod excluding `chat_messages`/`admin_audit_log`, anonymize, restore into staging via **direct** (5432); re-seed synthetic onboarding rows.
11. Add GitHub Actions workflows: auto `db push` on push to `staging`, **manual** (`workflow_dispatch`) `db push` for prod.
12. Add an "Environments" note to `CLAUDE.md`/`HANDOFF.md` naming both refs + the QA app URL.
13. Smoke test staging: Google + email sign-in, an onboarding session (JWT hook + realtime isolation), a `/api/llm` call; confirm writes land in **staging**, not prod.

**Approval gates:** every `db push` (migrations), all staging dashboard toggles (auth hook, allowlist, OAuth), and the prod→staging data copy (PII).
