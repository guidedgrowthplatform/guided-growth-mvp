# Environments: dev / staging / main

How Guided Growth runs three environments, each with its own TestFlight build, mirroring the per-branch Vercel previews on the web side. This is the runbook for standing the system up and for promoting a build from dev to staging to main.

Status: the code and CI in this repo are env-aware (see "What is wired" below). The account-level resources (Apple bundle ids, App Store Connect apps, Supabase projects, GitHub Environments) are one-time manual setup, listed under "Prerequisites". Until those exist, the default single-environment production release (push a `v*` tag) keeps working unchanged.

---

## The model

Web already has per-branch previews for free: Vercel builds a preview URL for every branch and the production deploy comes from `main`. Mobile cannot do that as cheaply (each iOS build burns slow macOS runner minutes, which are scarce), so the mobile mirror is three long-lived stages instead of one-per-branch:

| Stage      | Branch    | Web (Vercel)      | iOS bundle id              | TestFlight app | Backend (Supabase)      |
| ---------- | --------- | ----------------- | -------------------------- | -------------- | ----------------------- |
| dev        | `develop` | preview deploy    | `app.guidedgrowth.dev`     | GG Dev         | dev project             |
| staging    | `staging` | preview deploy    | `app.guidedgrowth.staging` | GG Staging     | staging project         |
| production | `main`    | production deploy | `app.guidedgrowth.mvp`     | GG (prod)      | prod project (existing) |

Distinct bundle ids mean a tester can hold dev, staging, and production side by side on one phone, the same way distinct preview URLs isolate the web. Production keeps the existing `app.guidedgrowth.mvp` id so the live TestFlight app and its testers are never disrupted.

Note on naming: `main` is the production branch. "main" and "production" refer to the same stage in this doc.

> **2026-06-10:** for the **database split**, [`supabase-environments.md`](./supabase-environments.md) is now authoritative. The staging Supabase project exists: ref `ppyouymvnrqxcsllrmsl` (prod: `pmunbflbjpoawicgimyc`). A `dev` Supabase project is still not provisioned.

---

## Local development: which backend

Local dev (`npm run dev`, `vercel dev`, and every `node scripts/*.mjs`) reads `.env.local`. To keep prod and staging cleanly separated, the active `.env.local` is **switched between two stored templates** rather than hand-edited:

| File                 | Holds                       | Loaded by Vite/scripts |
| -------------------- | --------------------------- | ---------------------- |
| `.env.staging.local` | staging Supabase + QA flags | no (template)          |
| `.env.prod.local`    | prod Supabase               | no (template)          |
| `.env.local`         | a copy of one of the above  | **yes (active)**       |

All three are gitignored. First-time setup: copy `.env.local.example` to `.env.staging.local` and `.env.prod.local`, fill each with that environment's Supabase URL / anon key / service-role key / `DATABASE_URL`. The shared keys (OpenAI, Cartesia, Soniox, Vapi, Resend) are the same in both.

Switch the active backend:

```bash
npm run env:staging          # safe default for day-to-day work
npm run env:prod -- --yes-prod   # deliberate; pointing local at prod is rare
```

`scripts/env/targets.mjs` resolves which project the live env points at (by Supabase ref) and exposes `assertSafeTarget()`. Destructive scripts (e.g. `reset-user-onboarding.mjs`) call it and **refuse to run against prod unless `ALLOW_PROD=1`** is set. Default local backend is **staging**, so local mistakes never touch production data.

---

## What is wired in this repo

These changes make a single codebase build any of the three stages from one set of inputs. With the env vars unset, behaviour is identical to the old single-env build.

- `capacitor.config.ts` reads `APP_IDENTIFIER` (bundle id), `APP_DISPLAY_NAME` (home-screen name), and `CAP_EXTRA_NAV_HOSTS` (extra allowNavigation hosts, comma-separated, for the stage's Supabase host). All default to the production values.
- `fastlane/Appfile` and `fastlane/Fastfile` read `APP_IDENTIFIER` for the iOS bundle id and the Android package name, and `MATCH_GIT_BRANCH` (defaults to `main`) for the match repo branch. The `beta` and `bootstrap_match` lanes are both env-aware.
- `.github/workflows/qa-release.yml` is the single QA pipeline. It fires on a `qa-v*` tag (manual `workflow_dispatch` kept as an escape hatch), is data-driven by the `staging` GitHub Environment, and builds **both** platforms for `app.guidedgrowth.staging`: iOS → TestFlight and Android (qa flavor) → Firebase. Shared build steps live in two composite actions (`.github/actions/setup-js-deps`, `.github/actions/capacitor-build`).
- `.env.local.example` documents the new vars for local builds.

Android has two product flavors (`prod` = `app.guidedgrowth.mvp`, `qa` = `app.guidedgrowth.staging`) in `android/app/build.gradle`. Prod ships from `ci.yml` on a `v*` tag (AAB → Play, APK → Firebase via `FIREBASE_APP_ID`); the QA flavor ships from `qa-release.yml` on a `qa-v*` tag (APK → Firebase via `FIREBASE_APP_ID_QA`), alongside the QA iOS build.

---

## Prerequisites (one-time, needs Apple + Supabase + GitHub admin)

These create the actual accounts and resources. They are outward-facing and account-level, so a human with the right access does them once. Owner: Alejandro.

### 1. Apple (per non-prod bundle id: dev and staging)

For each of `app.guidedgrowth.dev` and `app.guidedgrowth.staging`:

1. App Store Connect, register the App ID (Certificates, Identifiers & Profiles, Identifiers).
2. App Store Connect, create a new App record with that bundle id, so it has its own TestFlight.
3. Add the appstore provisioning profile to the match repo by running the `match-bootstrap` workflow once with the Environment's `APP_IDENTIFIER` set (it writes the cert and profile for that id into the match repo). Grant the match deploy key write access for the run, then revoke.

Production (`app.guidedgrowth.mvp`) already has its App ID, App record, and match profile.

### 2. Supabase (per non-prod stage: dev and staging)

> **2026-06-10:** staging is done — project ref `ppyouymvnrqxcsllrmsl`. See [`supabase-environments.md`](./supabase-environments.md) (authoritative) and [`staging-rollout.md`](./staging-rollout.md) for wiring status.

1. Create a Supabase project for the stage.
2. Run the migrations (`supabase/migrations/`, order: `000 -> 001 -> 002 -> 003`).
3. Note the project URL and anon key (client) and service role key (server) for the stage.
4. Add the stage's web redirect URLs to that project's Auth, URL Configuration allowlist (see `CLAUDE.md`, "Auth email flows" for the exact list).

Keeping prod data isolated from test traffic is the whole point of separate projects. If cost or time forces it, staging and dev can temporarily share the prod backend, but then bugs in a dev build write to prod data. Not recommended past the very short term.

### 3. Vercel (per non-prod stage)

Per-branch previews already exist, so `develop` and `staging` get preview URLs automatically. Set the stage's server env vars (Supabase url, service role key, etc.) as Vercel environment variables scoped to those branches, or run separate Vercel projects per stage if you want stable URLs.

### 4. GitHub Environments (per stage: dev, staging, production)

In Settings, Environments, create `dev`, `staging`, `production`. On each, set:

Variables:

- `APP_IDENTIFIER` (e.g. `app.guidedgrowth.dev`)
- `APP_DISPLAY_NAME` (e.g. `GG Dev`)
- `CAP_EXTRA_NAV_HOSTS` (that stage's Supabase host, e.g. `abcd.supabase.co`)
- `VITE_API_URL` (that stage's web origin)
- `MATCH_GIT_BRANCH` (optional, defaults to `main`)

Secrets (same names as `ci.yml`, but each scoped to the stage):

- Web: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPI_PUBLIC_KEY`, `VITE_VAPI_ASSISTANT_ID`, `VITE_CARTESIA_AGENT_ID`, `VITE_STATE3_ENABLED`, `VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`
- iOS: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_CONTENT`, `APPLE_TEAM_ID`, `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_DEPLOY_KEY`

The Apple signing secrets are the same across stages (one team, one match repo, one ASC API key); only the per-stage Variables and the Supabase/Vapi secrets differ.

---

## Building QA (staging)

1. Push a `qa-v*` tag, e.g. `qa-v2.9.3` (the marketing version is derived from the tag: `qa-v2.9.3` → `2.9.3`). Or run `qa-release.yml` from the Actions tab and pass a `version`.
2. The run builds the web bundle once with the `staging` Environment's vars/secrets, then builds **both** the iOS IPA → QA TestFlight and the Android qa APK → Firebase `internal-testers`.

Production is unchanged: push a `v*` tag to ship via `ci.yml` (iOS builds by default; repo var `SKIP_TESTFLIGHT=true` skips it). `qa-v*` does not match the `v*` glob, so QA tags never trigger a prod release.

> The previous per-environment iOS dispatch workflow (`mobile-env-release.yml`) and the standalone `qa-android-release.yml` were consolidated into `qa-release.yml`. A `dev` stage is not currently wired.
>
> Both QA platforms now share one web bundle built under the `staging` Environment, so the QA app's baked-in config (`VITE_API_URL`, `VITE_*`) follows that Environment. ~~Keep staging's values equal to prod while the backend is shared~~ **(2026-06-10: superseded — the `staging` Environment's values now point at the staging Supabase `ppyouymvnrqxcsllrmsl`; see [`supabase-environments.md`](./supabase-environments.md))**. If values diverge, QA Android content follows staging, not prod.

---

## Promotion runbook: dev to staging to main

Promotion is a code merge. A change rides up the same three branches, getting wider exposure at each step.

1. Build on `develop`. Feature branches merge into `develop` via MR. (A `dev` stage build is not currently wired — smoke on a staging build for now.)
2. Promote to `staging`. Open an MR `develop -> staging`. After it merges, push a `qa-v*` tag to ship the staging build (iOS + Android together). Staging is the rehearsal: production-like config, this is where QA signs off.
3. Promote to `main`. Open an MR `staging -> main`. After it merges, ship production by tagging `v*` (iOS builds by default; `SKIP_TESTFLIGHT=true` skips it). This is the build founding users receive.

Rules:

- Promotion is always forward and via MR (`main` is protected, a human merges). Never push straight to `main`.
- Do not cherry-pick a build "straight to prod". A production build should have existed on staging first.
- A hotfix branches off `main`, merges to `main` via MR, then merges back down into `staging` and `develop` so the stages do not drift.

---

## Follow-ups (not in this change)

- Android prod/qa flavors are wired (prod → Play + Firebase via `ci.yml`, qa → Firebase via `qa-release.yml`). A full per-stage `dev` Android id + per-stage Play tracks are still open if Android is to mirror an iOS three-app split beyond prod/qa.
- Per-stage release notes wiring is handled by the release-notes step (see the s2 work and `docs/RELEASE.md`).
- A `dev` stage (third TestFlight app + GitHub Environment) is not wired. QA tags are explicit (`qa-v*`) to protect scarce macOS runner minutes; revisit auto-on-branch if minutes allow.
