# Flow sync: designer to engine

The onboarding engine runs its flow as DATA, loaded from a generated JSON file,
instead of a hand-authored TS module. A design change is now a data edit plus a
regenerate, not a code build. This file explains the bridge.

## The pieces

| File                                          | Role                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../transform/designerSource.ts`              | Mirror of the designer's `DEFAULT_FLOW` array (from `ggmvp-flow-builder/src/components/flow-designer/FlowBuilder.tsx`). The source of truth for what the flow contains. |
| `../transform/designerToFlow.ts`              | The transform. Maps the designer flow to the engine `FlowDocument`.                                                                                                     |
| `../../../scripts/flow-sync/generate-flow.ts` | The runnable script. Runs the transform, validates, writes the JSON.                                                                                                    |
| `onboarding-beginner-v1.generated.json`       | The generated flow the engine LOADS at runtime (`../useFlow.ts`).                                                                                                       |
| `onboarding-beginner-v1.ts`                   | The hand-authored TS flow, kept as the SAFE FALLBACK only.                                                                                                              |

## How the engine loads it

`../useFlow.ts` imports `onboarding-beginner-v1.generated.json`, checks its shape,
runs the flow-machine validation, and serves it. If the JSON is missing, the wrong
shape, or fails validation, it falls back to the hand-authored TS flow. The engine
never breaks on a bad generated file; the worst case is it runs the proven TS flow.

## Run the transform

```bash
npm run flow:sync
```

This regenerates `onboarding-beginner-v1.generated.json` from the designer source.
The script validates the output (no dangling node references) before writing and
fails loudly if the graph is broken.

## Make a design change

1. Edit the flow in the designer (`ggmvp-flow-builder`), OR edit the mirror at
   `../transform/designerSource.ts` directly.
2. If you edited the designer, paste the new `DEFAULT_FLOW` array into
   `../transform/designerSource.ts` (keep it in lockstep with the builder).
3. Run `npm run flow:sync`.
4. The new JSON is what the engine runs. No code build needed for content changes
   (openers, screen IDs, order). Adding a NEW component type still needs a one-time
   mapping entry in `../transform/designerToFlow.ts` (`TYPE_TO_COMPONENT` plus an
   `ENGINE_BEAT_SPECS` row) and a renderer registry entry.

## The field mapping (designer to engine)

| Designer field                       | Engine `FlowDocument` field                                    |
| ------------------------------------ | -------------------------------------------------------------- |
| `type`                               | `componentType` (via `TYPE_TO_COMPONENT`; intro types skipped) |
| array order                          | the `nextId` chain down the beginner spine                     |
| `props.greeting` / `props.coachLine` | `voice.openerText` (the `{name}` token is preserved)           |
| `sheetStage` (text before the colon) | `screenId` (and `context.screenId`)                            |
| beginner / advanced choice           | the `path-fork` `BranchNode` with `simple` / `braindump` lanes |

Engine facts the flat designer array cannot express (per-beat `persist` step, LLM
`tool`, `beatNumber`, graph `backId`, the synthesized advanced-input lane) live in
`ENGINE_BEAT_SPECS` in the transform, keyed by component type. The designer owns
order, type, opener, screen ID, and component props; the engine table owns
structure, persistence, and tools.

## Correctness

`../transform/designerToFlow.test.ts` asserts the transform output deep-equals the
hand-authored TS flow (the no-op swap proof), that the committed JSON is in sync
with the transform, and that the runtime loader serves a valid flow. If the
"committed generated JSON is up to date" test fails, run `npm run flow:sync`.

## Follow-up: Supabase publish

This file-based JSON is the migration-period MVP (spec section 5.2). The clear
follow-up is the `flow_versions` Supabase table: the admin builder publishes a
`nodes` blob, and `loadPublishedFlow` in `../useFlow.ts` swaps its body for a
React Query fetch (cached once at onboarding entry). The orchestrator and renderer
never change; they only ever see a `FlowDocument`. See
`gg-spec/docs/flow-builder-export-spec.md` sections 5.2 and 6 for the open team
decisions (runtime versioning, merge-point screen IDs, sub-screen modeling).
