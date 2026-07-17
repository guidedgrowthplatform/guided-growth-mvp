# Phase B Flow-Pipeline Builder Report

## Delivered

- Added the strict Phase A contract reader in `scripts/onboarding/lib/readContract.ts`.
  It rejects malformed JSON, duplicate keys, unknown fields, invalid envelopes,
  invalid references, duplicate beat IDs, and duplicate orders.
- Added the contract-to-flow adapter in `scripts/flow-sync/contractToFlow.ts` and
  selected it with `FLOW_SYNC_SOURCE=contract`. The default remains the legacy
  designer-source compiler path. `deriveStepMaps.ts` is unchanged.
- Added the six-beat fixture contract at
  `src/onboarding-flow/flows/onboarding-contract.v1.json`. It includes a
  variant family (`welcome` / `welcome-women`), complete contract envelope,
  legacy crosswalk, Vapi, MP3, hybrid, Silent, self, gated, and manual beats.
- Added the generated `@gg/shared/onboarding/beatIds` skeleton at
  `packages/shared/src/onboarding/beatIds.ts`, its source generator at
  `scripts/onboarding/lib/generateBeatIds.ts`, and its command at
  `scripts/onboarding/generate-beat-ids.ts` / `npm run onboarding:beat-ids`.
- Added the not-applied five-map migration inventory at
  `docs/phaseB-beat-id-codemod-not-applied.md`.
- Added focused coverage in
  `src/onboarding-flow/transform/contractPipeline.test.ts`.

## Final Gates

Environment: Node `v22.23.1`, npm `10.9.8`.

| Command | Result |
| --- | --- |
| `npm ci` | PASS. Postinstall `tsc -b packages/shared --force` passed. Husky printed `.git can't be found`, expected for this non-checkout worktree. npm reported existing dependency audit advisories. |
| `npx tsc --noEmit` | PASS. |
| `npx vitest run src/onboarding-flow/transform/contractPipeline.test.ts` | PASS: 1 file, 3 tests. |
| `FLOW_SYNC_SOURCE=contract npm run flow:sync` | PASS: wrote the six-node contract flow, derived step maps, linear-flow exports, and six-beat combined bundle. |
| `npm run flow:sync` | PASS: legacy designer source remained the default and wrote the 22-node onboarding flow plus dependent generated outputs. |
| `npm run onboarding:beat-ids` | PASS: regenerated `packages/shared/src/onboarding/beatIds.ts` from the fixture contract. |

## Scope Notes

- No API writers, migrations, audio implementation, or analytics senders were changed.
- The requested external Phase A/Phase B spec paths were unavailable in this
  environment. The implementation follows the contract schema and Phase B
  scaffolding already present in the worktree; the fixture and focused tests
  exercise that contract end-to-end.
