# Builder-to-engine lane (Slot B) — STATUS

Lane doc: gg-spec/docs/fable-lane-builder-engine-2026-07-03.md (parent: fable-window-plan-2026-07-03.md).
Base: origin/staging @ 5750a2fb (merge train !398 !400 !401 !397 !403 !402 verified merged).

**MERGE HOLD**: draft MRs only; nothing merges to staging until Yair clears the human
walkthroughs (gg-qa-iota rebuilds on staging merges and would swap builds under testers).

| ID   | Item                                                                                                                                               | Status | MR  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --- |
| L1-1 | Validate at the boundaries (zod Export schema, throw on unknown type, post-transform checks)                                                       | open   |     |
| L1-2 | Typed registries (satisfies Record<FlowComponentType,...>, kill beatEngineMeta JSON re-import)                                                     | open   |     |
| L1-3 | Derive step maps from flow JSON (ENTRY_SERVER_STEP, STEP_TO_SCREEN_ID, SCREEN_TO_STEP, beatForStep, LLM addendum, preconditions)                   | open   |     |
| L1-4 | Canonical artifact (delete/demote designerSource.ts mirror + onboarding-beginner-v1.ts fallback)                                                   | open   |     |
| L1-5 | Multi-flow enablement (flow registry, conditional fork passes, new TYPE_TO_COMPONENT entries, per-flow persistence, generic /flow-preview/:flowId) | open   |     |
| L1-6 | Morning check-in from the builder                                                                                                                  | open   |     |
| L1-7 | Evening check-in from the builder                                                                                                                  | open   |     |
| L1-8 | App tour from the builder (stretch)                                                                                                                | open   |     |

Updated: 2026-07-03 12:48 EAT
