# Stage 1 CI Report Mode

**Date:** 2026-07-17  
**Status:** implemented in report mode  
**GitLab job:** `render-checks-report`

## Job definition

`render-checks-report` is a Node 22 GitLab CI job that runs on branch pipelines when changes touch the flow-designer render source, render-check scripts, dependency manifests, or `.gitlab-ci.yml`.

```yaml
render-checks-report:
  stage: render-checks
  image: node:22
  allow_failure: true
  rules:
    - if: '$CI_COMMIT_BRANCH'
      changes:
        - src/components/flow-designer/**/*
        - scripts/render-consistency-check.mjs
        - scripts/render-link-integrity-check.mjs
        - scripts/verify-objective1.mjs
        - package.json
        - package-lock.json
        - .gitlab-ci.yml
  before_script:
    - node --version
    - npm --version
    - npm ci --ignore-scripts
  script: report each command status and exit nonzero when any check fails
  artifacts:
    when: always
    expire_in: 1 week
    paths:
      - render-checks-summary.txt
```

The job runs the four requested commands in this order:

1. `npm run check:render`
2. `npm run check:links`
3. `npm run check:beats` (records a skip when the script is not defined)
4. `npm run verify:objective1`

The job writes the normal command output to its log and publishes `render-checks-summary.txt`, containing only the four command statuses, as a one-week artifact. It is configured with `allow_failure: true`; a failed check is visible in CI but does not block the pipeline.

The required-gate flip remains an explicit reviewed change: confirm report-mode reliability, extend `check:beats` with new static checks, remove `allow_failure: true`, and require `check:beats` plus `verify:objective1` with normal failing exit codes.

## Local validation

Environment: `nvm use 22` selected Node `v22.23.1` and npm `10.9.8`.

### `npm run check:render`

```text
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).
Exit: 0
```

### `npm run check:links`

```text
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.
Exit: 0
```

### `npm run check:beats`

```text
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.
Exit: 0
```

### `npm run verify:objective1`

```text
locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
Exit: 0
```

## CI YAML validation

`npx gitlab-ci-local --list` was unavailable because `gitlab-ci-local` is not installed in this worktree. YAML syntax was validated with the installed `yaml` package's `parseDocument` API after the CI change.
