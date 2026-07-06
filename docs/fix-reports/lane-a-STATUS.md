# Lane A STATUS (engine capability, onboarding consolidation)

Lane A of gg-spec/docs/onboarding-consolidation-plan-2026-07-06. Owner territory: schema, engine renderer, narration driver, new components. Updates append at the top.

## 2026-07-06 STEP 0 DONE, MR !444 open (draft), GATES LANE B

- Schema contract landed on branch `lane-a-step0-schema`, MR !444 (draft, target main).
- Carries: narration[] ({kind: bubble|reveal, n, say?, clip?}) per beat, per-line clip refs (narration + meta.perElement.clip), variant (render-time art switch; builder visibility tags shared/production/qa filtered), hideOrb, componentOwned, componentType custom-entry (kind goal|habit, minimal adapter + forked-flow detour nodes), weekly-projection state contract locked.
- Verified: 256 tests green incl. new step0SchemaContract.test.tsx round-trips; flow:sync byte-identical on all five committed flows; tsc clean; eslint 0 errors.
- Lane B authoring notes are in the MR !444 description (narration at beat top level, normalized kinds; do not use 'female' as a builder visibility tag).
- Next: A1 narration driver (bubble/reveal sequencing inside one beat, karaoke on real audio via the merged word-sync scheduler; caption files when present, duration fallback). Then A2 weekly-projection real grid, A3 custom-entry polish, A4 componentOwned wiring (coordinates with the orb session via MR notes), A5 one-per-goal.

## Standing

- Branch+draft MRs only, conductor merges. New GitLab (gitlab.guidedgrowthapp.com) only.
- Orb territory (components/orb/*, beats 3+5 sequences) belongs to the orb session; Lane A wires TO it, never edits it.
- No em dashes; coach lines never say tap/scroll/click/press/swipe.