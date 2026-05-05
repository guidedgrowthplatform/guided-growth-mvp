# Releasing iOS + Android

The release pipeline is fully automated. A single tag push to `main`
produces a signed iOS build in TestFlight and a debug Android APK in
GitHub Actions artifacts, with a Mattermost notification when the APK
is ready. End-to-end takes ~10–15 minutes.

## Quick reference

```bash
git checkout main && git pull --ff-only           # latest
git tag -a v2.1.2 -m "your release notes"          # tag the commit
git push origin v2.1.2                             # fire the pipeline
```

That's it. Watch under **GitHub → Actions → CI/CD Pipeline**. When
green, the iOS build is in **App Store Connect → TestFlight →
Builds**, and the Android APK link is posted to the **MVPtesting**
Mattermost channel.

## Step-by-step (first-time releaser)

### 1. Pre-flight

- Make sure `main` is clean and you've pulled the latest:
  `git status` should show "nothing to commit, working tree clean".
- All MRs that need to be in this release are merged.
- The previous CI run on `main` (the per-commit one — validate, build)
  is green. If it's red, fix that first; don't tag on top of broken
  main.
- Test suite is green locally if you've changed anything risky:
  `npm run test:coverage && npm run type-check`.

### 2. Pick a version number

Tags follow [semver](https://semver.org/) prefixed with `v`:

| Bump                            | When                                           | Example       |
| ------------------------------- | ---------------------------------------------- | ------------- |
| **Patch** (`v2.1.1` → `v2.1.2`) | Bug fixes, copy tweaks, no API changes         | most releases |
| **Minor** (`v2.1.x` → `v2.2.0`) | New user-facing feature, additive changes      | feature drops |
| **Major** (`v2.x.x` → `v3.0.0`) | Breaking changes, redesigns, schema migrations | rare          |

Look at the latest tag for context:

```bash
git tag --sort=-v:refname | head -5
```

The number on the tag is independent from the App Store **marketing
version** (`CFBundleShortVersionString`). The CI build number comes
from `GITHUB_RUN_NUMBER` automatically; you don't bump anything by
hand.

### 3. Tag and push

```bash
git tag -a v2.1.2 -m "Release v2.1.2: short description of what changed"
git push origin v2.1.2
```

Use **annotated** tags (`-a … -m …`) — they carry release notes that
GitLab and GitHub display in the tags UI. Lightweight tags (`git tag
v2.1.2` without `-a`) work but lose the message.

### 4. Watch the pipeline

The `v*` tag triggers
[`CI/CD Pipeline`](../.github/workflows/ci.yml). Job order:

1. `validate-and-test` — lint, type-check, vitest, npm audit
2. `build` — Vite production bundle (with all `VITE_*` env baked in)
3. **`build-apk`** (parallel) — Android debug APK + Mattermost ping
4. **`ios-testflight`** (parallel) — `cap sync ios` → fastlane match →
   archive → upload to TestFlight

Open the run from **GitHub → Actions** and follow along. If anything
goes red, see the [troubleshooting section](#when-something-fails)
below.

### 5. Verify the release

- **iOS:** App Store Connect → TestFlight → Builds. The new build
  number (matches `GITHUB_RUN_NUMBER` from the run) shows up within
  ~5 min after the workflow turns green; processing takes another
  5–10 min before testers can install. Add to a tester group via the
  build's "Test Information" → "Add to Group".
- **Android:** Mattermost #MVPtesting channel posts a link to the APK
  artifact. Anyone in the channel can download and sideload.
- **Release notes:** add a brief changelog under the tag in
  GitLab → Tags → click the tag → Edit, or write directly in the
  `git tag -m` message above.

### 6. (Optional) Cancel a release in flight

If you spot a bug in the build before testers grab it:

- **GitHub → Actions →** click the running workflow → **Cancel
  workflow** in the top right. Cancels all jobs.
- If it already uploaded to TestFlight, you can mark the build as
  "Expired" in App Store Connect — testers will no longer be able to
  install it.

### 7. (Optional) Yank a tag

Don't reuse a tag — pick the next patch number instead. But if the
tag was wrong (typo, pointed at the wrong commit, etc.):

```bash
git tag -d v2.1.2                              # delete locally
git push origin :refs/tags/v2.1.2              # delete remotely
```

Then create the correct tag. Note: this **doesn't undo the CI run**
— for that, follow step 6.

## Manual dispatch (for CI changes)

When iterating on the pipeline itself (workflow file, fastlane
config, etc.), you don't want to burn a release tag every iteration.
Instead:

**GitHub → Actions → "CI/CD Pipeline" → Run workflow → pick branch
→ Run.**

This runs the full pipeline including iOS TestFlight upload — useful
to validate end-to-end. Can also be done from CLI:

```bash
gh workflow run "CI/CD Pipeline" --ref <branch-or-main>
```

Note: each manual dispatch that succeeds **also uploads to
TestFlight**. If you're iterating fast, expect a parade of nearly
identical builds in App Store Connect; nothing to worry about, but
add release notes to the meaningful ones.

## What's automated

| Concern                               | Mechanism                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code signing                          | `fastlane match` pulls certs + appstore profile from `gitlab.com/guidedgrowth-group/match-certificates` (encrypted, read-only deploy key in `MATCH_DEPLOY_KEY`) |
| Build number                          | `GITHUB_RUN_NUMBER` injected by `increment_build_number` in `fastlane/Fastfile`                                                                                 |
| Code signing settings                 | `update_code_signing_settings` flips the freshly-generated xcodeproj to manual signing with the match profile                                                   |
| `NSMicrophoneUsageDescription`        | Added by [`scripts/patch-ios-plist.mjs`](../scripts/patch-ios-plist.mjs) after every `cap sync ios`                                                             |
| `ITSAppUsesNonExemptEncryption=false` | Same patch script — auto-bypasses the App Store Connect export compliance prompt                                                                                |
| iOS 26 SDK requirement                | Workflow runs on `macos-26` (Xcode 26 default)                                                                                                                  |

## What still requires manual action

- **Marketing version** (the `1.0.x` users see, distinct from the build
  number) — bump in App Store Connect or run
  `cd ios/App && agvtool new-marketing-version 1.0.x` locally.
- **TestFlight tester groups** — add via App Store Connect.
- **App Store review submission** — separate workflow (not yet wired up).
- **App icons / splash screens** — currently using placeholders, need
  proper assets before public release.

## When something fails

1. **Actions tab → click the red run → expand the failed step**. Most
   errors print a clear message in the last ~30 lines.
2. **Match clone fails (`permission denied` or `not found`):** the
   `MATCH_DEPLOY_KEY` got rotated or the public side was removed from
   the GitLab repo. Run the [`Bootstrap match repo (one-shot)`](../.github/workflows/match-bootstrap.yml)
   workflow after temporarily granting write permission to the deploy
   key (revoke it again right after — see "Match recovery" below).
3. **`SDK version issue (409)` on upload:** Apple bumped the required
   SDK floor again. Bump the `runs-on:` label in
   [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (e.g.
   `macos-26` → `macos-27` once it exists).
4. **`missing argument for parameter #2 in call`** inside Capacitor
   plugin sources: the runner regressed to a Swift 5.x Xcode. Ensure
   the runner label is the latest (currently `macos-26`).
5. **Build succeeds, TestFlight shows nothing:** the upload sometimes
   takes ~5–15 min to appear after CI goes green; check "Activity" tab
   in App Store Connect for processing status.

## Match recovery (when you need to regenerate certs)

The match repo holds an encrypted distribution cert + appstore profile.
If you need to regenerate them (cert expired, accidentally nuked,
etc.):

1. **GitLab → `match-certificates` repo → Settings → Repository →
   Deploy Keys → tick "Grant write permissions" on the
   `guided-growth-mvp CI match` key → Save**.
2. **GitHub → Actions → "Bootstrap match repo (one-shot)" → Run
   workflow → main → Run**.
3. Wait for it to complete. It generates the cert + profile via the
   App Store Connect API key, encrypts with `MATCH_PASSWORD`, and
   pushes to the match repo.
4. **GitLab → uncheck "Grant write permissions" → Save**.
5. Trigger a normal release (tag push or manual dispatch).

## Don't touch unless you know why

- The `match-certificates` GitLab repo — only modify via `fastlane match`.
- Any `MATCH_*` or `ASC_*` GitHub Actions secret.
- The `bootstrap_match` lane in `fastlane/Fastfile` (writes signing
  material).
- `scripts/patch-ios-plist.mjs` — extend only when you need a new
  Info.plist entry that Capacitor doesn't inject.
- The pinned `~8.1.0` Capacitor versions in `package.json` — kept until
  the plugin ecosystem republishes against the post-8.1 native API.

## Files of interest

| Path                                    | Purpose                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `fastlane/Fastfile`                     | iOS `:beta` lane (release) and `:bootstrap_match` lane (one-shot) |
| `.github/workflows/ci.yml`              | Main pipeline (validate → build → Android APK + iOS TestFlight)   |
| `.github/workflows/match-bootstrap.yml` | Manual-only match population workflow                             |
| `scripts/patch-ios-plist.mjs`           | Idempotent post-`cap sync` plist patcher                          |
| `capacitor.config.ts`                   | Bundle ID, plugin config, native scheme                           |
