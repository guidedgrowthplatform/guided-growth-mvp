# Reader Alignment Report

## Scope

- Workdir: `/home/ggvoice/build/gg-phaseb-flow`
- Node: `v22.23.1` via `nvm use 22`
- Authority artifact: `src/onboarding-flow/flows/onboarding-contract.v1.json`
- Contract SHA-256: `67ec46343ec02b6a18e8a67d8eb758edcac0fc500dc3ffd062305d9548e500df`

## Real Contract Envelope

The reader was compared with the copied real artifact, which contains 13 strict top-level properties and 62 beats.

Top-level properties:

- `schemaId`
- `schemaVersion`
- `sourceGitSha`
- `contractRevision`
- `contractSeq`
- `globalContext`
- `toolArgumentSchemas`
- `variantToBaseBeatId`
- `beatIdToRollbackScreenId`
- `variantSelections`
- `legacyCrosswalk`
- `renames`
- `beats`

Every beat carries these 21 properties:

- `id`, `name`, `order`, `path`, `type`, `parent`, `advance`, `context`, `openerSeq`
- `allowedTools`, `expectedResponse`, `voice`, `hideOrb`, `props`, `elements`, `perElement`
- `script`, `scriptMeta`, `beatIO`, `conversation`, `acceptanceCriteria`, `applicableDecisions`

## Reader Alignments

Updated `scripts/onboarding/lib/readContract.ts` to keep strict unknown-property rejection while accepting and validating the real envelope.

1. Added required top-level `contractSeq`, validated as a safe integer.
2. Added required top-level `variantToBaseBeatId`, validated as `Record<string, string>`.
3. Added required top-level `beatIdToRollbackScreenId`, validated as `Record<string, string | null>`.
4. Added required per-beat `perElement`, validated as an array of strict objects:
   `{ elementId: string, line: string, order: safe integer, showsAsBubble: boolean }`.
5. Retained strict validation that every `variantToBaseBeatId` key is a concrete emitted beat ID and every rollback-map key is a concrete emitted beat ID.
6. Removed invalid reader assumptions that `parent` and `variantToBaseBeatId` values must themselves be concrete emitted beats. The real contract uses logical base IDs such as `onboarding-beat-6-profile` and `onboarding-beat-18-week-projection` for those values.

## Compiler Alignments Found During Re-run

The real contract then exposed compiler-side vocabulary and graph-shape differences. These were aligned to preserve the contract as authority.

1. Added contract type mappings in `scripts/flow-sync/contractToFlow.ts`:
   - `splash` -> `primary-button`
   - `get-started` -> `primary-button`
   - `splash-intro` -> `coach-bubble`
2. Logical parent IDs are compiled to a valid runtime `backId` by retaining concrete parent IDs and using the preceding concrete ordered beat when the parent is a logical, non-emitted base ID. This makes the generated graph pass runtime reference validation without changing contract data.
3. Updated `src/onboarding-flow/transform/contractPipeline.test.ts` from stale fixture-era IDs/counts to assertions over the real 62-beat artifact, including the new envelope fields and the logical-parent runtime fallback.

## Re-run Results

- `npm run type-check`: PASS.
- `npm run flow:sync`: PASS (legacy designer path; 22-node onboarding output, entry `auth`).
- `FLOW_SYNC_SOURCE=contract npm run flow:sync`: PASS (real contract path; 62-node onboarding output, entry `onboarding-beat-1-splash`).
- `npx vitest run src/onboarding-flow/transform`: PASS after the legacy sync path, 6 files / 60 tests.
- `npx vitest run src/onboarding-flow/transform/contractPipeline.test.ts src/onboarding-flow/transform/step0SchemaContract.test.tsx`: PASS against the final contract-generated workspace state, 2 files / 13 tests.

The full transform directory contains legacy designer-output equality tests. It is intentionally run after the legacy path, because its committed fixture expectation is the designer output. The final workspace was then regenerated through the contract path as required.

## Final Real-Contract Artifacts

The final workspace is contract-generated, not fixture-era output:

| Artifact | Identity | SHA-256 |
| --- | --- | --- |
| `src/onboarding-flow/flows/onboarding-contract.v1.json` | source contract, 62 beats | `67ec46343ec02b6a18e8a67d8eb758edcac0fc500dc3ffd062305d9548e500df` |
| `src/onboarding-flow/flows/onboarding-beginner-v1.generated.json` | `onboarding-contract-v1`, 62 nodes, entry `onboarding-beat-1-splash` | `f9aaa11376fe14aaab4eca06cff71b4f35aee05cc38d6404ae4487e7f0cb205a` |
| `api/_lib/llm/onboarding/stepMaps.generated.ts` | derived from the 62-node contract flow | `48f13ba8841038623a57ebe1ccde1d2b9393eb67e4c9e2d3e1871a05e2e81902` |
| `src/generated/onboarding_combined.json` | 62 beats, 62 engine metadata entries, 19 coach-context entries | `79d269b55cf40a2c4c7efb6ed7f4c8eb8afc0c80be8a5bb0faeab693da07e320` |
