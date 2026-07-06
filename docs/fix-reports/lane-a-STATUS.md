# Lane A STATUS (engine capability, onboarding consolidation)

Lane A of gg-spec/docs/onboarding-consolidation-plan-2026-07-06. Owner territory: schema, engine renderer, narration driver, new components. Updates append at the top.

## 2026-07-06 LANE A COMPLETE: A2/A3/A5 (!448) + A4 (!449) up; full stack drafted

- Merge order: !444 (STEP 0) -> !447 (A1) -> !448 (A2+A3+A5) -> !449 (A4). All drafts, conductor merges.
- A2: WeeklyProjectionAdapter renders the real WeeklyHabitsSummary via weeklyProjectionData.ts (grid math ported from the render's beats/weeklyProjection.tsx: start-day week, weekday-only rituals, per-frame percentages, gaps Tue-Thu empty, reported-only header percent). Real captured habits feed the rows when present. Shared grid component untouched (weekly-summary-component territory); streak math exported for its future streak column.
- A3: custom-entry frozen receipt shows the captured name.
- A5: habitSelectionRules.ts, two goals = one habit per goal (replace inside goal), one goal = up to cap; voice adds route through the rule.
- A4: componentOwned beats render adapter-only (no driver audio, completion-signal advance; SplashIntro.onComplete already signal-driven); hideOrb suppresses the docked FlowVoiceControls while active. Seam note posted on the orb session's !446. components/orb/* and welcome/ untouched.
- All verified live on /flow-preview/lane-a-demo (76% p78 real grid, receipt value, orb unmount/return round-trip) + 281 tests green + tsc clean.
- Remaining Lane A liabilities: none planned. Follow-ups live with other territories: Lane B authors narration content + captions (openerCaptions.ts keyed by resolved src), orb session wires greeting/mic sequences to the seams, weekly-summary-component owns the grid's streak column.

## 2026-07-06 A1 DONE, MR !447 open (draft, stacked on !444)

- Narration driver landed: NarrationBeatView + narrationSchedule (pure) + narrationClips + NarrationRevealContext; StateCheckAdapter first bloom consumer; BeatView routing + legacy-audio suppression on narration beats; past-beat scripted-line replay.
- Audio reuses useBeatOpenerMp3 per segment (pool, gesture fallback, activation tokens, QA mute); karaoke via openerRevealPin; captions per clip via openerCaptions.ts keyed by resolved src (word-accurate when present, duration fallback otherwise).
- Demo preview /flow-preview/lane-a-demo (flow lane-a-demo-v1, QA-gated, droppable post-Lane-B): verified live, sequencing in sync, no console errors. 265 tests green.
- Next: A2 weekly-projection real grid (port grid math from the render's beats/weeklyProjection.tsx onto WeeklyHabitsSummary).

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