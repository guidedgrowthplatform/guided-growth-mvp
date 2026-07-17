# Exporter Builder Report

## Artifact

- Authoritative output: `dist-flow/onboarding-contract.v1.json`
- Envelope: `schemaId`, `schemaVersion: 1`, `contractSeq: 1`, `sourceGitSha: 0c71ebb2`, and deterministic `contractRevision`.
- Revision: `sha256:89891f7e719632410c8095aae98b942b5e1bd19dcc520047961f0203831b2dfb;git:0c71ebb2`
- Size: 309,570 UTF-8 bytes; 62 dense, ordered beats.

## Fields Exported

- Global contract data: `GLOBAL_CONTEXT`, tool argument schemas, variant selections, transitional `ONBOARD-*` legacy crosswalk, variant-to-base collapse map, and `beatIdToRollbackScreenId` reverse map.
- Every beat: identity/order/path/type/parent, derived advance contract, context/opener, allowed tools and expected response, voice engine/mode/per-line resolution, visibility/props/elements, and script lines.
- Script coverage: `words`, bindings, voice, clip, relative clip path, expected-user response, reveal metadata, timing metadata, and per-element lines.
- Runtime contracts: persistence IO, conversation contract, acceptance criteria, and applicable decisions.
- Migration safety: `renames` is emitted as the required empty v1 tombstone map. The artifact has 57 legacy crosswalk entries, 47 variant-collapse entries, and 62 rollback-map entries.
- Tool schemas: 15 deterministic local JSON Schema objects are derived from the consolidated source's `bible.allowedTools.specs`; every `allowedTools` entry resolves to one.

## Explicitly Absent

- No requested contract family is omitted.
- `renames` intentionally has no entries in v1 because no beat ID has yet been retired.
- Source-defined nullable/empty values remain explicit contract values (for example, silent beats have no script lines and beats with no legacy screen retain `null` rollback IDs).
- No `generatedAt` timestamp is emitted.
- Git-history/provenance-shell verification and secret scanning are deliberately not added: the task explicitly prohibited Git commands and the milestone CUT list excludes exporter secret scanning.

## Changed Files

- `scripts/export-render-parity.mjs`: derives and validates tool argument schemas, preserving stable-sorted JSON serialization and existing deterministic envelope/export behavior.
- `scripts/test-render-contract.mjs`: verifies nonempty exported tool schemas and per-beat tool-schema resolution, alongside byte round-trip, field coverage, and two-run hash reproducibility.
- `dist-flow/onboarding-contract.v1.json`: regenerated authoritative artifact.

## Gates

```text
$ npm run build:flow
vite v5.4.21 building for production...
✓ 2274 modules transformed.
✓ built in 7.07s
Wrote dist-flow/onboarding-contract.v1.json with 62 beats

$ npm run test:render-contract
PASS round-trip byte-identical
PASS field coverage
PASS hash reproducibility (2 runs)
PASS render contract gates

$ node scripts/export-render-parity.mjs --check
Verified dist-flow/onboarding-contract.v1.json with 62 beats
```

`npm ci` also completed under Node `v22.23.1` / npm `10.9.8`; npm reported its pre-existing dependency audit advisories.
