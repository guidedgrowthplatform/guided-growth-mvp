---
name: testflight-release
description: Use when cutting a new iOS TestFlight / Android Play release, bumping the app version, tagging a build for distribution, or asked to "ship a release" / "push v2.x". Covers the v* tag → CI → TestFlight + Play internal pipeline, tester release notes, and the semver decision.
user-invocable: false
---

# TestFlight Release

A release is cut by pushing an annotated `vX.Y.Z` tag to `origin`. CI does the rest.

## How the trigger works

- `origin` is GitLab (`gitlab.com/guidedgrowth-group/guided-growth-mvp.git`), mirrored to GitHub.
- The `ios-testflight` job in `.github/workflows/ci.yml` fires on push events matching `refs/tags/v*` (see `ci.yml:220-233`). Manual `workflow_dispatch` also works.
- Fastlane (`fastlane/Fastfile` `lane :beta`) builds the IPA and uploads to App Store Connect.
- Build number is auto-bumped from `GITHUB_RUN_NUMBER` (`Fastfile:36`). You do **not** edit it manually.
- Marketing version comes from the tag (the `vX.Y.Z` you push).

## Versioning policy

Semver against the previous release tag:

| Bump | When |
|------|------|
| **Patch** (`v2.3.0` → `v2.3.1`) | Only fixes / chores. No new user-facing capability. |
| **Minor** (`v2.3.0` → `v2.4.0`) | At least one new feature commit (`feat:`) on top of fixes. |
| **Major** | Breaking change for shipped users (rare for an MVP — confirm with Yair). |

Always check `git log <last-tag>..HEAD` before deciding. `package.json` `version` is **not** the source of truth — tags are.

## Tester notes (TestFlight "What to Test" + Play release notes)

One committed file drives the tester-facing notes on **both** stores — automated, no console editing:

- **File:** `release-notes/whatsnew-en-US` (plain text, no extension; `whatsnew-<locale>` is the Play-required naming). Edit this one file in place each release — never create a versioned copy.
- **iOS:** `fastlane/Fastfile` reads it (`__dir__`-anchored) and passes it as `upload_to_testflight(changelog:)` → TestFlight "What to Test". Fail-safe: if the file is missing, `changelog` is `nil` and the upload still succeeds (no notes).
- **Android:** `ci.yml` Play step sets `whatsNewDirectory: release-notes` → Play release notes. A guard step **fails the build** if the file is missing or **>500 chars** (Play's per-locale limit; iOS allows ~4000).
- **Content:** tester-facing "what to test" steps (not a dev changelog). Keep it ≤500 chars, plain ASCII. ~4–5 short steps is the sweet spot.
- Add a second file (e.g. `whatsnew-es-ES`) only for another **locale**; the same text goes to both stores otherwise.

## Cutting a release

1. **Confirm you're on `main` and up to date:**
   ```bash
   git checkout main && git pull
   ```
2. **Pick the version** using the table above. List unreleased commits:
   ```bash
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```
3. **Update tester notes** — overwrite `release-notes/whatsnew-en-US` with this release's "what to test" (≤500 chars), and commit it to `main` *before* tagging so the tag captures it. CI reads the file at tag time.
4. **Create the annotated tag** with a release-note message (mirror the style of `git show v2.3.0`):
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z: <short title>

   - <bullet per significant commit>
   - Builds on v<previous> (<one-line of what that shipped>)"
   ```
   Annotated tags only (`-a`), never lightweight — they carry the release notes and the tagger identity.
5. **Push the tag:**
   ```bash
   git push origin vX.Y.Z
   ```
6. **Verify CI fired** — check GitHub Actions for the `iOS TestFlight` job on the new tag. Build typically takes 12–18 min.
7. **Confirm in App Store Connect** that the new build appears in TestFlight before notifying testers.

## Before tagging — checks

- Working tree clean on `main` (`git status`). Don't tag with uncommitted work — the tag points at `HEAD` and untracked files are not included anyway, but a dirty tree usually means something was forgotten.
- Don't reuse a version (`git tag -l vX.Y.Z` should return empty).
- Don't tag a fork of `main` — the tag must be reachable from `main` so future `git describe` works.
- This action is high blast radius (cloud build, real TestFlight users). **Always confirm the version with the user before pushing the tag.**

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Bumping `package.json` instead of tagging | Tags drive the marketing version. `package.json` version is currently stale (`2.1.0`) and unused for releases. |
| Editing build number in Xcode / Capacitor config | CI overrides it from `GITHUB_RUN_NUMBER`. Hand-edits get overwritten. |
| Lightweight tag (`git tag vX.Y.Z`) | Use `-a` so release notes ship with the tag. |
| Pushing to GitHub directly | We push to `origin` (GitLab); GitHub is downstream via mirror. |
| Tagging before a fix is merged to `main` | `ios-testflight` only fires for tags reachable from `main`. Merge first, then tag. |
| Forgetting to update `release-notes/whatsnew-en-US` | Testers get last release's "what to test" (iOS) or the build fails the 500-char guard (Android). Edit + commit it before tagging. |

## Rollback

You can't recall a TestFlight build, but you can stop testers from receiving it via App Store Connect (expire the build). For the git side, deleting a published tag is a no-op for what's already in TestFlight and confuses future `git describe` — leave the tag and ship a follow-up patch version instead.
