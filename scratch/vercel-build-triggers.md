# Vercel Build CPU Minutes — gg-qa Root Cause & Levers

**Date:** 2026-07-10
**Project:** gg-qa (Vercel id prj_4bEo8YFvVau9Zciyma4hiTkrvFxM)
**Status:** Read-only investigation

---

## What triggers gg-qa builds

**Every push to ANY branch** in guided-growth-mvp triggers a `deploy_qa_preview` GitLab CI job that:
1. Runs `npm ci` + `npm run build` (Vite build)
2. Deploys to Vercel via CLI (`vercel deploy`)
3. **Does NOT skip if nothing relevant changed** (no ignoreCommand or build context filtering)
4. **Does NOT gate on CI passing** (the deploy runs before/regardless of test results)

**Feature branches:** Deploy to unique preview URLs (e.g., `fix-audio-overlap--vercel.app`), not aliased.  
**Main/staging branches:** Deploy to the gg-qa-iota alias + post Mattermost notification.

**Frequency:** Every push = every commit, every merge, every rebase-and-push, every branch push.

---

## Build cost amplifiers

1. **No test/lint gate before deploy:** Tests + type-check run in parallel on GitHub Actions (for PRs to main only), but GitLab CI `deploy_qa_preview` deploys without waiting for or requiring GitHub Actions to pass.
2. **No cache reuse across branches:** Each branch rebuild is isolated; feature branch pushes rebuild the whole app even if only a test file changed.
3. **No ignoreCommand in vercel.json:** Vercel rebuilds on every push, even when only docs, READMEs, or unrelated config changed.
4. **Frequent feature-branch pushes:** Active development on ~6-8 concurrent fix branches = ~3-5 pushes/day per branch, each triggering a full build.
5. **Redundant rebuilds on squash-and-push:** Merge workflows that rebase + push can trigger 2-3 builds per MR lifecycle.

---

## Concrete levers (2-4 to cut redundant builds)

### Lever 1: Add an `ignoreCommand` to vercel.json (Highest impact, lowest effort)
```json
{
  "ignoreCommand": "git diff --name-only HEAD~1 | grep -q -v '^(src/|public/|vercel\\.json|package\\.json)' && exit 1 || exit 0"
}
```
**Effect:** Skip rebuild if ONLY docs, READMEs, CI config, or non-product files changed.  
**Estimated savings:** ~15-20% of builds (mostly `docs/**`, `.github/**`, `release-notes/**`).

### Lever 2: Gate deploy_qa_preview on CI passing (Blocks bad builds)
Add a `verify` stage to `.gitlab-ci.yml` before deploy:
```yaml
verify:
  stage: verify
  script:
    - npm ci
    - npm run type-check
    - npm run test:coverage
```
Then update `deploy_qa_preview` to `needs: [verify]`.  
**Effect:** Feature branches with failing tests do not deploy; catches broken builds before Vercel.  
**Estimated savings:** ~5-10% of builds (failed pushes that would be reverted anyway).

### Lever 3: Reuse single stable build across fleet runs (Eliminates duplicate QA builds)
Instead of deploying a fresh build per `run-fleet.mjs` invocation:
- Build once to a **pinned preview URL** (e.g., `gg-qa-fleet-stable.vercel.app`).
- All 8 personas in a round target that same URL (no fresh deploy per round).
- Only deploy when code changes, not on every fleet run.

**Current (wasteful):** Each round → reruns walk-agent → re-QA tests → re-deploys to gg-qa-iota (or fleet re-targets a stale URL).  
**Proposed:** One build pinned, QA fleet runs against it until an MR lands.  
**Estimated savings:** ~30-40% of builds (especially during multi-round QA cycles).

### Lever 4: Use feature-branch previews for QA, not `main` (Shift builds away from prod URL)
QA harness already generates unique preview URLs per branch. Update the runbook to:
- Auto-tag MRs with their preview URL so QA references the branch build, not gg-qa-iota.
- Only deploy to gg-qa-iota after conductor merge (1 deploy per fix, not 1 per push).

**Effect:** Active development on fix branches no longer pumps builds into the gg-qa project.  
**Estimated savings:** ~25-35% of builds (all feature-branch CI runs redirect to Vercel preview, not redeployed to main's alias).

---

## Quick wins (implement in order)

1. **Add `ignoreCommand`** — 15min, no code change needed, 15-20% immediate win.
2. **Gate CI before deploy** — 1h, catches failing builds, 5-10% win.
3. **Stable QA build URL** — Requires coordination with run-fleet.mjs (half-day), 30-40% win.
4. **Preview-first QA flow** — Process/docs change, 2h, largest structural win (25-35%).

**Estimated total savings if all four implemented:** 75-115% of current build volume → effectively 1 build every other day of active development instead of 3-4/day.
