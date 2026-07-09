# Render Branch CI Pipeline Investigation

## Query Results

### 1. Recent Pipelines (Last 20)
All pipelines in recent history ran on feature branches like `bugfix-status-2026-07-02` and `feat/onboarding-behavior-rules` — **zero pipelines on `flow-annotated-render`**.

### 2. Pipeline 1427 (the "render guards CI")
- **Pipeline ID:** 1427
- **Ref (branch):** `ci/wire-render-guards` (NOT `flow-annotated-render`)
- **Status:** success
- **Source:** push

This pipeline ran on the SOURCE branch before the MR was created, not as MR CI.

### 3. .gitlab-ci.yml Existence Check
- **On `flow-annotated-render`:** MISSING (404 not found)
- **On `main`:** EXISTS

### 4. Merge Requests Targeting flow-annotated-render
Sample of MRs targeting the render branch:
- MR !525 (fix/render-voice-beats-3-6) → **head_pipeline: null**
- MR !524 (fix/play-button-to-header) → **head_pipeline: null**
- MR !523 (render/collapse-variants) → **head_pipeline: null**
- MR !522 (annotate/exemplar-beats) → **head_pipeline: null**
- MR !521 (ci/wire-render-guards) → **head_pipeline: null**

### 5. CI Configuration on main
The `.gitlab-ci.yml` on main contains:
```yaml
.branch_push_rules: &branch_push_rules
  - if: '$CI_COMMIT_BRANCH'

verify:
  stage: verify
  rules: *branch_push_rules
  ...
```

This rule WOULD trigger on any branch push IF the config file existed on that branch. But since the config file doesn't exist on `flow-annotated-render`, there is no CI.

## Conclusion

**Do render MRs get a pipeline?** NO.

**Why?** The `.gitlab-ci.yml` file does not exist on the `flow-annotated-render` branch. GitLab only runs CI if it finds a valid CI config file on the source branch of an MR. Since render MRs source from branches like `fix/render-voice-beats-3-6` (which also do not have `.gitlab-ci.yml`), there is no CI pipeline.

**What is the actual merge gate for a render MR?** None. Render MRs have zero CI protection and can merge without any automated checks.

**The "render guards CI" (pipeline 1427)** is a misnomer — it ran on `ci/wire-render-guards` as a direct push, not as MR CI. That pipeline would add CI guards IF the source branch had a copy of `.gitlab-ci.yml`, but the feature was never completed or deployed to the render branch itself.
