# Onboarding builder-to-engine contract: schema spec

Status: P1 of `gg-spec/docs/builder-engine-contract-design.md` (define the seam, emit a validated contract). This is the field-by-field spec for `onboarding-contract.json`, the versioned file the builder exports and the engine will be generated from. The machine schema is `contract.schema.json` at the repo root; this doc is the human companion.

## What this is (and is not)

- It IS the FULL runnable projection of every onboarding beat, with variant inheritance RESOLVED FLAT at export. Every beat here is concrete: the engine consumes it directly and never re-runs inheritance.
- It carries RUNNABLE data only. Spec-only material (applicable decisions, identity narrative, scriptMeta reveal/timing) stays builder-side and is not in the beats.
- `acceptance` rides in a separate top-level block for later test generation, deliberately out of the runnable beats.
- It is distinct from `parity.json`. `parity.json` (schemaVersion 2, `scripts/export-render-parity.mjs`) is the narrow order/identity/audio parity artifact and stays exactly as-is. The contract is wider. Both publish from `dist-flow`.

## Source and generation

- Source: `src/components/flow-designer/beatsSource.ts#BEATS_SOURCE` (62 beats). The only human-edited onboarding store.
- Exporter: `scripts/export-contract.mts`, run via `tsx` (same pattern as `scripts/dump-resolved-beats.mts`, because it imports the TypeScript resolver `resolveBeatStructure`).
  - `npm run export:contract` writes `dist-flow/onboarding-contract.json`.
  - `npm run check:contract` (`--check`) re-derives the contract, validates it, and fails if the committed artifact does not reproduce from source (guard 1 + a staleness guard). Wired into `npm run check:beats`.
  - `npm run build:flow` runs the export after the parity export, so every builder deploy publishes `/onboarding-contract.json` next to `/parity.json` (both `Cache-Control: no-store`).
- Validation: the exporter validates the built contract against `contract.schema.json` with a minimal built-in draft-07 structural validator (no new dependency; `zod`/`ajv` were not added). A schema violation exits non-zero and fails the build.

## Variant resolution (flattened at export)

A beat with `variantOf` set inherits from its head. The exporter calls `resolveBeatStructure(id)`, so:

- Runnable top-level fields (`script`, `component.props`, `voiceEngine`, `path`, `screenId`) are already authored per-variant on each beat and pass through as-is.
- The bible-derived fields (`context`, `allowedTools`, `flow`, `edges`) come from the RESOLVED bible: head sections are inherited with head tokens substituted out (category label, clip ids, screenId, beatId, rule-id prefix), and category-sensitive sections are rebuilt from typed per-family data. No head token survives onto a variant.
- `persistence` comes from the resolved `io` (`beat.io ?? head.io`).
- `variantOf` is retained on the beat as provenance only; the content is already flat.

## Reproducibility

`generatedAt` is deterministic: the ISO commit time of `beatsSource.ts` (overridable with `CONTRACT_GENERATED_AT`), not wall-clock, so a rebuild of the same source is byte-for-byte reproducible. `--check` strips `generatedAt` from both sides before comparing, so a git-less environment can never cause a false staleness failure; the staleness comparison is content-only.

## Top-level shape

```
{
  schemaVersion: 1,
  source:      { beats: "src/components/flow-designer/beatsSource.ts#BEATS_SOURCE" },
  generatedAt: string | null,
  idMap:       { screens: { <screenId>: <beatId> }, clips: { <clip>: <clipPath> } },
  beats:       BeatContract[],
  acceptance:  { beatId, rows: { criterion, check }[] }[]
}
```

| Field           | Type           | Derives from                      | Notes                                                                                 |
| --------------- | -------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `schemaVersion` | `1`            | constant                          | Bumps on any add/rename/remove so a consumer detects an unknown shape.                |
| `source.beats`  | string         | constant                          | The one authored store.                                                               |
| `generatedAt`   | string \| null | git commit time of beatsSource.ts | Provenance only; never in the staleness compare.                                      |
| `idMap.screens` | map            | each beat's `screenId` -> `id`    | The bridge id map kept until the screenId->beatId rename lands.                       |
| `idMap.clips`   | map            | every beat's clip id -> clipPath  | Raw material for P4 rename safety. First occurrence wins.                             |
| `beats`         | BeatContract[] | `BEATS_SOURCE` order              | 62 beats.                                                                             |
| `acceptance`    | block[]        | resolved `bible.acceptance`       | SPEC-ONLY, separate from beats. Present for beats that resolve an acceptance section. |

## BeatContract (runnable)

Every field is required (see `contract.schema.json` `$defs.beatContract`). Beat-spec section names below refer to the 14-section bible in `beatsSource.ts`.

| Field          | Type                                          | Beat-spec section / source                                           | Notes                                                                                                                                                                                              |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | string                                        | `beat.id`                                                            | Canonical beat id.                                                                                                                                                                                 |
| `order`        | integer                                       | `beat.order`                                                         | Position.                                                                                                                                                                                          |
| `screenId`     | string \| null                                | `beat.screenId`                                                      | Bridge id, kept until the rename lands.                                                                                                                                                            |
| `variantOf`    | string \| null                                | `beat.variantOf`                                                     | Head id, provenance only; content is resolved flat.                                                                                                                                                |
| `path`         | `beginner`\|`advanced`\|`both`                | `beat.path`                                                          |                                                                                                                                                                                                    |
| `component`    | object                                        | `beat.type` + `beat.props` + `beat.hideOrb` + `beat.elements`        | `{ key, props, config:{hideOrb}, elements[] }`. `key` is the stable component registry key (the beat's `type`). Component CODE stays app-side behind this key; only the key + data cross the seam. |
| `script`       | ScriptLine[]                                  | `beat.script`                                                        | See ScriptLine below.                                                                                                                                                                              |
| `opener`       | string \| null                                | derived from `script`                                                | First coach-bubble line with words, else first line with words (mirrors parity).                                                                                                                   |
| `voiceEngine`  | `MP3`\|`Cartesia`\|`Vapi`\|`Silent`           | `beat.voiceEngine`                                                   |                                                                                                                                                                                                    |
| `voiceMode`    | `Verbatim`\|`Generative`\|null                | `beat.voiceMode`                                                     |                                                                                                                                                                                                    |
| `context`      | string \| null                                | resolved `bible.contextProse.prose`, else `beat.context`             | The per-beat coach context the LLM reads (section: contextProse). See the two-source note under Known Phase 3.3 work items.                                                                        |
| `allowedTools` | string[]                                      | resolved `bible.allowedTools.tools`, else parsed `beat.allowedTools` | Tool ids the beat may call (section: allowedTools).                                                                                                                                                |
| `persistence`  | `{ writes:[{key,writtenBy}], reads:[{key}] }` | resolved `io.dataOut` / `io.dataIn`                                  | The Supabase-bound keys it writes and the keys it reads (section: persistence).                                                                                                                    |
| `flow`         | `{ advanceWhen, branches }`                   | resolved `bible.flow.rows`                                           | Both are prose/structured unions today (section: flow). See unions below.                                                                                                                          |
| `edges`        | prose/structured union                        | resolved `bible.edges.rows`                                          | Error / off-topic / crisis / tool-failure handling (section: edges).                                                                                                                               |
| `assets`       | `{ clips:[{clip,clipPath}] }`                 | distinct clips in `beat.script`                                      | The id-keyed audio material for the id map.                                                                                                                                                        |

### ScriptLine

`{ seq, speaker, words, bindsTo:{kind,element,screen}, voice, clipPath }`

- `speaker` is the constant `"coach"`: `beatsSource` has no per-line speaker field and every line is a coach utterance. The user's expected reply is a beat-level fact (`expectedResponse`), not a script line.
- `clip` (the short id) is intentionally NOT on the line. `clipPath`'s basename is the clip id, and the id <-> path pairs are collected in `assets.clips` and `idMap.clips`, so the line stays on the locked seam shape without duplicating the id.
- `voice` is `verbatim`\|`mp3`\|`cartesia`\|null.

## The prose / structured unions (Phase 3.3 seam)

`flow.advanceWhen`, `flow.branches`, and `edges` are prose-only in the beat spec today. Each is exported as a tagged union so Phase 3.3 (formalization) can fill in structured data per beat WITHOUT a schema break:

```
advanceWhen | branches : { kind: "prose", text: string|null }
                       | { kind: "structured", ... }

edges                  : { kind: "prose", rows: [{ edge, behavior, voice }] }
                       | { kind: "structured", ... }
```

Today the exporter always emits the `prose` variant. The `structured` variant's `kind` is fixed but its other fields are left open (`additionalProperties: true`) so 3.3 can add the real shape with no schema-version bump. The INTENDED structured targets, documented here so 3.3 has a target:

- `advanceWhen` structured: the advance gate as `{ kind:"structured", tool: string|null, when: string }` (which tool firing, under what condition, advances the beat).
- `branches` structured: `{ kind:"structured", branches: [{ to: <beatId>, when: <condition> }] }` (routing targets by beat id).
- `edges` structured: `{ kind:"structured", categories: { toolFailure?, offTopic?, crisis?, error?, ambiguous? } }` (each a behavior string), classifying the currently free-form edge rows.

When 3.3 lands, the parity/semantic guards (design guards 3 and 5) can start resolving `branches[].to` and `advanceWhen.tool` against real beats and tools.

## Known Phase 3.3 work items (fields that resisted clean export)

The exporter reports these to stderr as non-fatal reconciliation items:

1. `context` has two authored sources on most beats: the top-level `beat.context` and the bible `contextProse.prose` differ (58 of 62 beats). The exporter prefers `contextProse` per the design and flags the disagreement. These two should be reconciled to one source before codegen (P2) consumes context.
2. `flow.advanceWhen` / `flow.branches` / `edges` are prose (see unions above) and need structured formalization.
3. `component.props` is `Record<string,string>` in `beatsSource`; richer component config (beyond `hideOrb`) is not yet modeled and will need a typed component-config contract when the engine's component registry is wired (design open decision 3).

`allowedTools` was checked for the same two-source problem (top-level string vs bible array); the two agree on all 62 beats, so no reconciliation is needed there.
