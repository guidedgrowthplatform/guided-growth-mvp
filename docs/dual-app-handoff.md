# Dual-App (Stable + QA) — Handoff

**Branch:** `feat/dual-app-stable-qa` → **MR !273**
**Status:** All code + assets done and verified. Ships once the account-level prerequisites below are completed.
**Owner:** Mint (overall + iOS). Android hands-on: Alejandro. Account access + decisions: Yair.

---

## 1. Goal

Two installable apps **side by side** on each phone — a **stable** app for daily real-use and a **QA** app for breaking things — distinguished by app id, name, and icon.

|                      | Stable                 | QA                               |
| -------------------- | ---------------------- | -------------------------------- |
| App ID               | `app.guidedgrowth.mvp` | `app.guidedgrowth.staging`       |
| Display name         | Guided Growth          | Guided Growth QA                 |
| Icon                 | blue `#135BEC` GG mark | red `#E5342A` GG mark            |
| Accounts             | real personal accounts | test accounts + "Start as Guest" |
| iOS distribution     | TestFlight             | TestFlight                       |
| Android distribution | Play internal track    | Firebase App Distribution        |

**Key architectural decision (locked 2026-06-06):** both apps point at the **same production backend**. There is **no staging database, no separate auth, no replicated services**. Isolation comes from **accounts**, not infrastructure. A true staging platform is a fine post-launch project but is explicitly out of scope.

**Correctness note on the isolation guardrail:** the per-user data boundary is enforced at the **API layer** — every query carries `WHERE user_id = $1` (the id comes from the verified session in `requireUser()`, `api/_lib/auth.ts`). It is **not** RLS: the API connects with the Supabase **service role**, which bypasses RLS entirely (see `CLAUDE.md` gotcha #5). A QA test account is therefore just an ordinary user row, fully scoped by the API. (The `gg-spec` doc currently says RLS is the guardrail — that wording should be corrected.)

---

## 2. What's been done (all on branch `feat/dual-app-stable-qa`)

Commits:

- `2016cce` — dual-app setup (iOS + Android + icons + guest)
- `1882c3c` + `3f007aa` — auto-derive QA adaptive icon layers from a single flat master
- `3effabb` — real QA app icon (white GG mark on red)

### 2.1 iOS (the pipeline was already env-aware; these are the gap-fills)

- **`.github/workflows/match-bootstrap.yml`** — added a `workflow_dispatch` input `app_identifier` (default `app.guidedgrowth.mvp`) and passed it as `APP_IDENTIFIER` to the run step. This lets you bootstrap signing (distribution cert + appstore provisioning profile) for `app.guidedgrowth.staging`. The Fastfile `bootstrap_match` lane already reads `APP_IDENTIFIER`.
- **`.github/workflows/mobile-env-release.yml`** —
  - Added a `version` input so tagless dispatch builds carry a real marketing version (otherwise they default to `1.0.0`).
  - Inserted the icon select + generation **in the correct order**: `cap sync ios` → `select-icon-master.mjs` → `@capacitor/assets generate --ios` → `patch-ios-plist.mjs`. Order is load-bearing: `@capacitor/assets generate` rewrites `Info.plist`, so the plist patch must run **after** it (else the CFBundleURLTypes/privacy-key patch is wiped). Before this change the per-env builds shipped the **Capacitor default placeholder icon** — there was no icon generation in this workflow at all.
  - Passes `APP_VERSION` to the fastlane step.
- **`fastlane/Fastfile`** — marketing version now prefers `APP_VERSION`, then the git tag; regex anchored as `/^v?(\d+\.\d+\.\d+)/` so it accepts both `2.9.2` and `v2.9.2` without matching an embedded version in a malformed string.
- **`scripts/patch-ios-plist.mjs`** — `CFBundleURLName` uses a validated `APP_IDENTIFIER` (regex `^[A-Za-z0-9.-]+$`, falls back to the prod id). The OAuth scheme is now **per-flavor**: stable registers `guidedgrowth://`, QA (`app.guidedgrowth.staging`) registers `guidedgrowthqa://` — keyed off the exact bundle id via the same rule as `src/lib/appVariant.ts` `schemeForAppId`. Android does the same via a `manifestPlaceholders.authScheme` per flavor; the runtime picks the matching scheme in `signInWithGoogle` via `authScheme()`. This stops the two apps from fighting over `guidedgrowth://auth/callback` when both are installed.

### 2.2 Android (net-new — flavors did not exist before)

- **`android/app/build.gradle`** — added `flavorDimensions "env"` with two product flavors: `prod` (inherits `app.guidedgrowth.mvp` from `defaultConfig`) and `qa` (`app.guidedgrowth.staging`). `namespace` stays `app.guidedgrowth.mvp` (it's the code package, independent of `applicationId`). Both flavors share the existing release keystore; the distinct `applicationId` is what lets them coexist on one device.
- **`android/app/src/qa/res/values/strings.xml`** (new) — QA source-set overrides: `app_name` = "Guided Growth QA", `package_name` + `custom_url_scheme` = `app.guidedgrowth.staging`.
- **`.github/workflows/ci.yml`** — stays **prod-only** (unchanged behavior vs. before flavors). On a `v*` tag it builds the `prod` flavor: `bundleProdRelease` (AAB → Play internal) + `assembleProdRelease` (APK → Firebase via `FIREBASE_APP_ID`). Only the gradle task/output-path names changed to the flavored form (`bundle/prodRelease/`, `apk/prod/release/`); prod distribution is otherwise identical to main.
- **`.github/workflows/qa-android-release.yml`** (new) — QA Android lives here, **not** in `ci.yml`. **Dispatch-only** (decoupled from the `v*` tag so a QA build can't red/block the stable release). Builds web → `select-icon-master qa` (red) → `@capacitor/assets generate` → `assembleQaRelease` → Firebase via `FIREBASE_APP_ID_QA` (job-level env so the skip-when-unset guard works). Optional `version` input; defaults `versionName` to `qa-<run_number>`.

### 2.3 Icons (two-master mechanism with auto-derive)

- **`scripts/select-icon-master.mjs`** (new) — picks the icon master for a build:
  - `qa`/`staging` → red set; anything else → no-op (blue stays canonical).
  - **You only ever commit `assets/icon-qa.png`** (the flat 1024² red master). The Android adaptive **foreground** (mark centered in the ~66% safe zone, transparent) and **background** (solid, color sampled from the master) are **auto-derived with sharp** when absent. This guarantees the layers always match the flat master — replace `icon-qa.png` and everything regenerates.
  - Fails loud if `icon-qa.png` is missing on a qa build.
- **`assets/icon-qa.png`** — the real QA artwork (white GG mark on red, 1024², opaque). Verified through the full pipeline.
- **`.gitignore`** — the two derived layers (`icon-foreground-qa.png`, `icon-background-qa.png`) are ignored (build artifacts).
- The blue/production masters (`assets/icon.png` + `icon-foreground.png` + `icon-background.png`) were already in the repo and are unchanged.
- Unrelated: `src/generated/icon-bundle.json` is in-app UI icons, untouched.

### 2.4 "Start as Guest" (QA-only feature)

- **`src/lib/appVariant.ts`** (new) — `isQaBuild()`: **runtime** detection via the native app id (`@capacitor/app` `App.getInfo().id === 'app.guidedgrowth.staging'`). Runtime, not build-time, because the Android prod/qa flavors share one web bundle — a build-time flag couldn't tell them apart. Promise-cached. Returns `false` on web.
- **`src/stores/authStore.ts`** — added `signInAsGuest()` calling Supabase `signInAnonymously()`, with PostHog `start_signup`/`complete_signup`/`signup_error` (method `guest`). `mapUser` now tolerates a null email (`email: u.email ?? ''`) for anonymous users.
- **`src/pages/WelcomePage.tsx`** — "Start as Guest" button rendered **only** when `isQaBuild()` is true; wired to `signInAsGuest()`. On success, AppGate redirects the now-authenticated user off the public route.
- **`src/pages/SettingsPage.tsx`** — `displayName` fallback changed `??` → `||` so a guest's empty-string email falls through to `'User'` instead of rendering blank (consequence of the `email ?? ''` change).

**No database migration is needed.** Anonymous users are ordinary `auth.users` rows, so the existing unconditional `on_auth_user_created` trigger fires → creates a `profiles` row → `profiles.anon_id` defaults via `gen_random_uuid()` → `custom_access_token_hook` injects `anon_id` into the JWT → `requireUser()` and the onboarding FK all work. (An earlier review claim that this would break isolation was wrong.)

---

## 3. Verification performed

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 788/788 pass.
- `npm run build` — clean.
- All three workflow YAMLs + `Fastfile` — syntax valid.
- Icon pipeline — smoke-tested from a clean state (only `icon-qa.png` present): derives fg/bg, swaps masters, generates; real QA icon rendered and inspected (flat for iOS, safe-zone foreground for Android).
- Max-effort code review run over the whole diff (36 verification passes). Confirmed fixes applied (SettingsPage `??`→`||`, Fastfile regex anchor, appVariant promise-cache, ci.yml DRY helper, build.gradle dedup). The top-severity "keystore path breakage" finding was a **false positive** (Gradle `file()` resolves to the module dir `android/app`, not the invocation cwd — proven by the original working build) and was correctly rejected.

---

## 4. What's remaining (all account-level — NOT code)

These are one-time setup steps a human with the right access performs. Nothing in the codebase blocks them.

### 4.1 iOS (Mint, with Yair for Apple access)

- [ ] Confirm the QA app `app.guidedgrowth.staging` exists in App Store Connect with its own TestFlight (Yair reported this done).
- [ ] Create the **GitHub `staging` Environment** (Settings → Environments) with:
  - Variables: `APP_IDENTIFIER=app.guidedgrowth.staging`, `APP_DISPLAY_NAME=Guided Growth QA`, `VITE_API_URL=` the **prod** web origin, `CAP_EXTRA_NAV_HOSTS` empty.
  - Secrets: **copy the production values verbatim** (shared backend) — `VITE_*`, `ASC_*`, `APPLE_TEAM_ID`, `MATCH_*`.
- [ ] Run **`match-bootstrap`** once with `app_identifier=app.guidedgrowth.staging` (grant the match repo deploy key write access for the run, then revoke).
- [ ] Run **`mobile-env-release`** with `environment=staging` (and a `version`, e.g. the current marketing version) → lands in the QA TestFlight. Production keeps shipping via the existing `v*` tag flow.
- [ ] Add the team to each app's TestFlight internal group; everyone enables Automatic Updates once.

### 4.2 Android (Alejandro)

- [ ] Create the "Guided Growth QA" app in Google Play Console (or at least the Firebase app for `app.guidedgrowth.staging`).
- [ ] Add the **`FIREBASE_APP_ID_QA`** secret (the QA Firebase Android app id) at **repo level** (the `qa-android-release.yml` workflow has no GitHub Environment, so it reads repo-level secrets) + confirm `FIREBASE_SERVICE_ACCOUNT_JSON` is present. Without `FIREBASE_APP_ID_QA` the QA distribution step skips silently (build still succeeds).
- [ ] (When push notifications are wired) add a `google-services.json` covering **both** package names, or split per source set. Not needed for App Distribution; only for FCM.
- [ ] Verify: a `v*` tag ships **prod** (AAB → Play internal, APK → Firebase via `FIREBASE_APP_ID`). Separately **dispatch `QA Android Build (Firebase)`** to ship the qa APK → Firebase `internal-testers`. QA Android is decoupled from the tag and does **not** ship on a `v*` tag.

### 4.3 Guest mode (Yair)

- [ ] **Enable Anonymous sign-ins** in the Supabase dashboard (Auth) on the **prod** project. Until this is on, the QA "Start as Guest" button returns an error. Pair with abuse controls (rate limiting) and a periodic cleanup policy for throwaway guest data.

---

## 5. How to operate it going forward

- **Replace the QA icon:** `cp <new>.png assets/icon-qa.png` and commit. The fg/bg layers auto-regenerate; no other change.
- **Ship a QA iOS build:** run `mobile-env-release` (env=staging, version=x.y.z).
- **Ship a QA Android build:** dispatch `QA Android Build (Firebase)` (optional `version`). Dispatch-only and intentionally decoupled from the `v*` tag.
- **Ship stable:** unchanged — push a `v*` tag (prod iOS TestFlight + prod Android AAB→Play + APK→Firebase).
- **QA test data:** lives under throwaway/guest accounts; deletable anytime. Real personal accounts live only in the stable app.
- **Versioning:** `major.feature.fix`, same string on both stores per release; single-source from the `v*` tag (iOS via agvtool, Android via `-PversionName`).

---

## 6. Risks / watch-items

- **Working tree hygiene:** `select-icon-master.mjs` mutates `assets/icon*.png` in place. CI is fine (fresh checkout each run). Locally, after testing a qa swap, restore with `git checkout -- assets/icon.png assets/icon-foreground.png assets/icon-background.png`.
- **Secrets:** `.env.local` holds live keys (e.g. `SONIOX_API_KEY`). It is git-ignored and not in this branch — keep it that way; never paste its contents into a commit/PR.
- **`gg-spec` doc edit:** ask Yair to amend the RLS wording (§1 above) so the team's mental model of the guardrail is accurate.
- **QA OAuth scheme — Supabase allowlist FIRST:** before distributing any QA build, add `guidedgrowthqa://auth/callback` to the Supabase **Redirect URLs** allowlist (prod project). Until then QA Google sign-in is dead on first install (Supabase rejects the redirect). Stable is unaffected (still uses the allowlisted `guidedgrowth://`).
- **Email-confirm handoff routes to stable on QA (known limitation):** the "Open in app" handoff (`authHandoff.ts`) fires from the shared web origin, which can't tell QA from stable, so it stays `guidedgrowth://` → opens the **stable** app. No data leak (signal only, shared backend), but QA email signup/reset can't return to the QA app. Mitigation: QA testers use **Start-as-Guest**; finish any email confirm on web.
