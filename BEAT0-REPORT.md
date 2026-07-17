# Beat 0 QA Control Report

**Date:** 2026-07-17  
**Environment:** `nvm use 22` → Node `v22.23.1`  
**Scope:** Add the QA launcher as annotated-render Beat 0 while preserving the splash as the first production runtime beat.

## Definition added

`src/components/flow-designer/beatsSource.ts` now begins with:

> `id: 'onboarding-beat-0-qa-control'`  
> `name: 'QA control'`  
> `order: 0`  
> `qaOnly: true`  
> `type: 'qa-control'`  
> `voiceEngine: 'Silent'`

The contract describes the real `/onboarding/qa` launcher from `/home/ggvoice/gg-ground/qa-screen/QAControlScreen.tsx` and its toolbar components:

> “test-user picker and Log in, Restart onboarding (fresh), Replay flow (preview), and Reset data only actions”

> “Vapi on/off reload toggle; QA audio mute/unmute toggle; QA return pill signs out and hard-navigates to `/onboarding/qa`”

Persistence is documented from the real implementation: selected user in `gg_qa_test_user`, live user fetch from `/api/qa/users`, QA sign-in/nickname update, `POST /api/qa/self-reset`, thread/query-cache clearing, preview routing, and QA Vapi/audio toggle state.

The required production exclusion rule is intentionally honest:

> “Never present this QA control screen in a production build path.”

Its enforcer is named `flow generator qaOnly exclusion (NOT-IMPLEMENTED)` in the beat contract. The render implementation nevertheless excludes `qaOnly` entries from runtime `BEATS`; `ANNOTATED_BEATS` retains Beat 0 so the annotated screen renders it first with a `QA-ONLY` badge.

## Census updates

- `BeatEntry` now carries `qaOnly?: boolean` through the type-only `flowBible.ts` contract.
- `BEATS_SOURCE` has 63 dense entries, ordered `0..62`; all existing entries moved forward by exactly one order slot.
- `verify:objective1` now expects baseline 62 plus the declared QA-only Beat 0 addition, requires the original ID order, requires every original order to move by exactly one, and compares locked copy without treating that mechanical shift as a copy delta.
- The verifier still reports exactly the two existing sanctioned copy deltas on original beats.
- `beatIdentityMap.json` and `beatIdentityMap.ts` register `/onboarding/qa` for Beat 0.
- `BEAT-AUDIT-TABLE.md` now begins with the QA-only Beat 0 row and states 19 official beats (`0` through `18`).
- Flow build parity output contains 63 beats and begins with `onboarding-beat-0-qa-control`.

## Gate outputs

| Command | Result | Output summary |
| --- | --- | --- |
| `npm run type-check` | PASS | `tsc --noEmit` exited 0. |
| `npm run check:render` | PASS | `63 beats, one source (beatsSource.ts)`. |
| `npm run check:links` | PASS | `63 beats, all bindsTo elements + clips resolve`. |
| `npm run build:flow` | PASS | Vite build exited 0; `Wrote dist-flow/parity.json with 63 beats`. |
| `npm run verify:objective1` | PASS | `baseline 62 beats + declared QA-only Beat 0 = 63 entries`, exactly two locked-copy deltas on original beats. |
| `npm run check:id-aliases` | PASS | `273 declared aliases map uniquely across 5 surfaces`. |
| `npm run check:decisions-coverage` | PASS | `7 locked ledger decision sections have rule-backed authored coverage`. |
| `npm run check:audio-ownership` | FINDING (exit 1) | Existing 12 MP3 lines without `clipPath`; none are Beat 0. |
| `npm run check:reveal-timing` | FINDING (exit 1) | Existing five recorded-clip reveal-gate failures; none are Beat 0. |
| `npm run check:beats` | FINDING (exit 1) | Render, links, and aliases pass; it stops at the existing audio-ownership findings. |

## Stage checks

Stage 1 commands continue to pass: `check:render`, `check:links`, and `verify:objective1`.

Stage 2 continues to behave without weakened assertions: ID aliases and decisions coverage pass; audio ownership and reveal timing preserve their pre-existing findings on older beats. Beat 0 adds no stage-2 finding.

## Build note

`build:flow` reports the existing Rollup chunk-size warning for a minified chunk above 500 kB. The build still exits successfully.
