# Stage 2 checks report

**Date:** 2026-07-17  
**Mode:** Render CI remains report-only (`render-checks-report`, `allow_failure: true`).  
**Node:** v22.23.1

## Implemented checks

- `check:id-aliases` → `scripts/id-alias-check.mjs`
- `check:audio-ownership` → `scripts/audio-ownership-check.mjs`
- `check:decisions-coverage` → `scripts/decisions-coverage-check.mjs`
- `check:reveal-timing` → `scripts/reveal-timing-check.mjs`

`check:beats` now sequences the existing render/link checks followed by all four Stage 2 checks. The CI report job watches the new scripts and contract fixtures, retains only the existing command-status summary artifact, and stays report-only.

## Real output

### `npm run check:id-aliases` — PASS (exit 0)

```text
id-alias-check passed: 272 declared aliases map uniquely across 5 surfaces.
```

### `npm run check:audio-ownership` — FAIL (exit 1)

```text
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beat-8-morning-checkin-setup; seq=2; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beat-8-morning-checkin-setup; seq=3; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beat-8-morning-checkin-setup; seq=4; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beat-9-evening-reflection-setup; seq=6; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beat-9-evening-reflection-setup; seq=8; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beat-10-experience-fork; seq=3; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beginner-beat-11-pick-category; seq=2; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beginner-beat-11-pick-category:women; seq=2; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beginner-beat-13-pick-habits; seq=2; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-beginner-beat-14-schedule-habits; seq=3; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-advanced-beat-15-capture-existing-habits; seq=2; expected=recorded line with existing declared asset; actual=no clipPath
id=audio-ownership-check; rule_id=audio-selection-contract; beat_id=onboarding-advanced-beat-16-schedule-existing-habits; seq=3; expected=recorded line with existing declared asset; actual=no clipPath
```

### `npm run check:decisions-coverage` — PASS (exit 0)

```text
decisions-coverage-check passed: 7 locked ledger decision sections have rule-backed authored coverage.
```

### `npm run check:reveal-timing` — FAIL (exit 1)

```text
id=reveal-timing-check; rule_id=checkin-reveal-gates; beat_id=onboarding-beat-8-morning-checkin-setup; seq=3; expected=prior recorded line gates reveal; actual=seq 2 voice=mp3
id=reveal-timing-check; rule_id=checkin-reveal-gates; beat_id=onboarding-beat-8-morning-checkin-setup; seq=4; expected=prior recorded line gates reveal; actual=seq 3 voice=mp3
id=reveal-timing-check; rule_id=reflect-reveal-gates; beat_id=onboarding-beat-9-evening-reflection-setup; seq=7; expected=prior recorded line gates reveal; actual=seq 6 voice=mp3
id=reveal-timing-check; rule_id=cat-reveal-gates; beat_id=onboarding-beginner-beat-11-pick-category; seq=3; expected=prior recorded line gates reveal; actual=seq 2 voice=mp3
id=reveal-timing-check; rule_id=catw-reveal-gates; beat_id=onboarding-beginner-beat-11-pick-category:women; seq=3; expected=prior recorded line gates reveal; actual=seq 2 voice=mp3
```

## Validation gates

| Command | Result |
| --- | --- |
| `npm run type-check` | PASS (exit 0) |
| `npm run check:render` | PASS — 62 beats, one source |
| `npm run check:links` | PASS — 62 beats, bindings and declared clips resolve |
| `npm run check:id-aliases` | PASS |
| `npm run check:decisions-coverage` | PASS |
| `npm run check:audio-ownership` | FINDING (exit 1) |
| `npm run check:reveal-timing` | FINDING (exit 1) |
| `npm run check:beats` | FINDING (exit 1; stops at audio ownership) |
| `npm run verify:objective1` | See command output below |
| `.gitlab-ci.yml` YAML parse | PASS |

## Findings

1. Twelve authored lines declare `voice: 'mp3'` but no `clipPath`. They fail the recorded-audio ownership contract. This check intentionally does not fall back to browser speech or treat a clip ID as a declared, existing asset.
2. Five reveal targets claim to gate on the preceding recorded clip, but their preceding MP3 lines do not declare a clip path. The reveal timing contract consequently cannot establish a recorded clip-end gate for those targets.

The failing checks are intentionally retained in report mode. No assertion was weakened to make the current source pass.

> life-growth-tracker@2.1.0 verify:objective1
> node scripts/verify-objective1.mjs

locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.

verify exit: 0
