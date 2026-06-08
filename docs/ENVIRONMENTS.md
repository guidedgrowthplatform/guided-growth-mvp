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

---

## What is wired in this repo

These changes make a single codebase build any of the three stages from one set of inputs. With the env vars unset, behaviour is identical to the old single-env build.

- `capacitor.config.ts` reads `APP_IDENTIFIER` (bundle id), `APP_DISPLAY_NAME` (home-screen name), and `CAP_EXTRA_NAV_HOSTS` (extra allowNavigation hosts, comma-separated, for the stage's Supabase host). All default to the production values.
- `fastlane/Appfile` and `fastlane/Fastfile` read `APP_IDENTIFIER` for the iOS bundle id and the Android package name, and `MATCH_GIT_BRANCH` (defaults to `main`) for the match repo branch. The `beta` and `bootstrap_match` lanes are both env-aware.
- `.github/workflows/mobile-env-release.yml` is a `workflow_dispatch` pipeline with an `environment` choice (dev / staging / production). It is data-driven by GitHub Environments: it reads each stage's bundle id, display name, web origin, and scoped secrets from that Environment, builds the web bundle, then builds and uploads the iOS IPA to that stage's TestFlight app.
- `.env.local.example` documents the new vars for local builds.

Android has two product flavors (`prod` = `app.guidedgrowth.mvp`, `qa` = `app.guidedgrowth.staging`) in `android/app/build.gradle`. Prod ships from `ci.yml` on a `v*` tag (AAB → Play, APK → Firebase via `FIREBASE_APP_ID`); the QA flavor ships from the dispatch-only `.github/workflows/qa-android-release.yml` (APK → Firebase via `FIREBASE_APP_ID_QA`).

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

## Building a stage's TestFlight

1. GitHub, Actions, "Mobile Env Release (TestFlight)", Run workflow.
2. Pick the environment (dev / staging / production).
3. The run builds the web bundle with that stage's secrets, then builds and uploads the IPA to that stage's TestFlight app. Testers see it under the matching app in TestFlight.

The existing tag-based `ci.yml` path still ships production (push a `v*` tag; iOS builds by default, set repo var `SKIP_TESTFLIGHT=true` to skip it). Use whichever you prefer for production; use this dispatch workflow for dev and staging.

---

## Promotion runbook: dev to staging to main

Promotion is a code merge. A change rides up the same three branches, getting wider exposure at each step.

1. Build on `develop`. Feature branches merge into `develop` via MR. Dispatch the dev TestFlight build, the team and Timothy smoke it against the dev backend.
2. Promote to `staging`. Open an MR `develop -> staging`. After it merges, dispatch the staging TestFlight build. Staging is the rehearsal: it runs the staging backend with production-like config, this is where QA signs off.
3. Promote to `main`. Open an MR `staging -> main`. After it merges, ship production either by tagging `v*` (iOS builds by default; `SKIP_TESTFLIGHT=true` skips it) or by dispatching this workflow for `production`. This is the build founding users receive.

Rules:

- Promotion is always forward and via MR (`main` is protected, a human merges). Never push straight to `main`.
- Do not cherry-pick a build "straight to prod". A production build should have existed on staging first.
- A hotfix branches off `main`, merges to `main` via MR, then merges back down into `staging` and `develop` so the stages do not drift.

---

## Follow-ups (not in this change)

- Android prod/qa flavors are wired (prod → Play + Firebase, qa → Firebase via `qa-android-release.yml`). A full per-stage `dev` Android id + per-stage Play tracks are still open if Android is to mirror the iOS three-app split beyond prod/qa.
- Per-stage release notes wiring is handled by the release-notes step (see the s2 work and `docs/RELEASE.md`).
- Optional: auto-dispatch the dev build on push to `develop`. Left manual on purpose to protect the scarce macOS runner minutes; revisit if minutes allow.
