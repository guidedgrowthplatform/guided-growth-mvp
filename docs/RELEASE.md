# Releasing iOS to TestFlight

The iOS pipeline is fully automated. From a clean `main`, a single tag
push lands a signed build in TestFlight in ~10 minutes.

## Ship a build

```bash
git tag v2.1.1
git push origin v2.1.1
```

The `v*` tag triggers
[`CI/CD Pipeline`](../.github/workflows/ci.yml) which runs:
`validate-and-test` → `build` (web bundle) → `ios-testflight` (archive

- upload). Watch progress under **GitHub → Actions**.

When it goes green, the build appears in **App Store Connect →
TestFlight → Builds**. Add testers / external groups in the App Store
Connect UI as you would normally.

For ad-hoc runs without a tag (e.g. testing a CI change): **Actions →
"CI/CD Pipeline" → Run workflow → main → Run**.

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
