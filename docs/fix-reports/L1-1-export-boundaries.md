# L1-1: Fail-loud boundaries for the builder Export pipeline

Lane: builder-to-engine (gg-spec/docs/fable-lane-builder-engine-2026-07-03.md). Ledger row L1-1.

## Why it was broken

Three silent-failure seams sat between the flow builder and the engine:

1. `designerSourceJson.ts` accepted ANY shape from `designer-source.json`. A typo'd
   field name (e.g. `voiceEngin`), a missing `componentType`, or a builder schema
   drift was silently coerced or dropped at paste time; the bad flow shipped.
2. `designerToFlow.ts` mapped unknown designer types through `TYPE_TO_COMPONENT[type]
?? null`, which reads "unknown" as "deliberately skipped": a new builder beat type
   was silently DELETED from the engine flow (the survey's confirmed drop class).
   A mapped type missing its `ENGINE_BEAT_SPECS` entry was dropped the same way.
3. Post-transform validation only checked graph integrity (dangling node ids). It could
   not catch a node missing runtime `meta`, or persist-step sequences that corrupt
   resume (steps are identity labels; the tap path pins `current_step` with GREATEST).

## What changed

- `designerSourceJson.ts`: strict zod schemas for the whole Export (document, beat,
  meta, engine, mp3Assets, perElement, orb). Unknown keys and missing required fields
  (`flowId`, `beat`, `name`, `componentType`, `meta`) throw with every offending path
  named (`parseExportDocument`). Build-time only: the throw fails `flow:sync`/tests,
  never a user session.
- `designerToFlow.ts`: `componentFor` throws on a type absent from `TYPE_TO_COMPONENT`
  (`qa-control` now explicitly null-mapped); a mapped type without an engine spec
  throws via `specFor` instead of being skipped.
- `flowMachine.ts`: `validateFlowAuthoring` = `validateFlow` + (a) every node carries
  runtime meta, (b) on any walk path a `persist.step` never recurs after a different
  step intervened (adjacent duplicates like habit-select/habit-schedule's shared 5
  stay legal), (c) inside a fork lane (the steps-2..5 back-nav window where numeric
  steps still mean position) steps are non-decreasing. Deliberately NOT a naive
  walk-order monotonicity check: v3 steps run 1,6,7,8,2,3,4,5,5 by design.
- `scripts/flow-sync/generate-flow.ts` gates on `validateFlowAuthoring` (exit 1).
- Runtime `useFlow` load path unchanged (graph check + TS fallback as before).

## Proof

- `exportValidation.test.ts`: malformed-Export matrix (unknown top-level/beat/meta
  field, missing componentType, missing meta, mistyped engine field, unrecognized
  designer type, missing node meta, non-monotonic lane steps, recurring step) each
  fails with a named error; the committed Export and generated flow pass.
- `npm run flow:sync` output byte-identical (generated JSON not in the diff).
- `npx tsc --noEmit` clean; `npx vitest run` 147 files / 1487 tests green.

## Upstream prevention

The builder can no longer drift its Export schema without flow:sync failing loud at
the exact path, and a future beat type cannot silently vanish from the engine flow.
The persist-step invariants make the resume-identity corruption class (B9's family)
a build failure instead of a runtime surprise.
