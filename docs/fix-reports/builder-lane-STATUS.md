# Builder-to-engine lane (Slot B) — STATUS

Lane doc: gg-spec/docs/fable-lane-builder-engine-2026-07-03.md (parent: fable-window-plan-2026-07-03.md).
Base: origin/staging @ 5750a2fb (merge train !398 !400 !401 !397 !403 !402 verified merged).

**MERGE HOLD**: draft MRs only; nothing merges to staging until Yair clears the human
walkthroughs (gg-qa-iota rebuilds on staging merges and would swap builds under testers).

**PRIORITY CHANGE (Yair, 2026-07-03 ~13:50)**: after L1-LOOP-1, jump to L1-LOOP-3
(L1-5/6/7) then L1-LOOP-4 (L1-8) BEFORE L1-LOOP-2 (L1-3/L1-4). Flows live first,
hardening after. L1-3 was already built when the change arrived; parked as draft !411.

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

BLOCKER (operator): creating the lane test user qa-onboarding-fable-builder@guidedgrowth.test
in staging Supabase was denied by the session permission layer. Preview WALKS are deferred
(code, tests, tsc, flow:sync all verified locally). To unblock, the operator can run:
`! node --env-file=.env.local scripts/qa/create-test-users.mjs`-style admin call for the lane
user (see scratchpad/create-lane-user.mjs) or grant the Bash permission and say "retry the lane user".
Named tester accounts are NOT used as fallback (human walkthroughs in progress).

Updated: 2026-07-03 14:06 EAT
