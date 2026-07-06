# Lane B STATUS: content + assets migration (onboarding consolidation)

Lane B of gg-spec/docs/onboarding-consolidation-plan-2026-07-06.md. One-time seed, render to flow builder/engine; after the seed the flow builder is the source of truth. Newest entry on top.

## 2026-07-06 (night): CONDUCTOR HANDOFF, one MR from done

STATE: !443 (converter) and !452 (assets) are MERGED on main. !453 (content seed) is the ONLY open Lane B MR: rebased onto main, retargeted to main, head 7c94f6e0, pipeline running at handoff time.

What 7c94f6e0 fixed since the last red: the two missing beat contexts (ONBOARD-BEGINNER-02-CUSTOM, ONBOARD-BEGINNER-03-CUSTOM; minimal simple-capture entries, verbatim render openers, submit_goals / add_habit + advance_step, house DO NOT style). beat-context-parity 16/16 locally. Earlier fix on the same MR: BeatNode narrowing for CI tsc.

MERGE GATE for !453 (all verified locally, CI re-confirms): pipeline green (verify = tsc + vitest incl. the parity tests), then mark ready and merge. It is a Draft; flip it when green.

REVIEW FLAGS riding !453 (also in its description):
1. One engine-table line: ENGINE_BEAT_SPECS state-check.backId why-intro -> profile (consequence of the why-intro drop). The why-intro spec entry, adapter, componentType, and two stale flow-order comments (designerToFlow.ts ~480/~993) remain as dead code; candidate cleanup MR, not blocking.
2. Test fixtures updated to the seeded flow (liveAdvanceFork, resumeFromServerRow, timelineStability, designerToFlow.test, step0SchemaContract). The step0 no-invention probe now runs over the four linear flows.
3. Close lines are narration kind close (advanced-frequency confirm converted from its trailing metadata bubble; advanced-capture given an explicit bubble+close script). The A1 driver owns playing close at capture-fire.
4. into-app buttonLabel = Start (conductor ruling 2026-07-06).
5. Custom-entry detours: nodeIds goal-custom / habit-custom, backIds goals / habit-select. One-per-goal cap on the detour capture is an A3/A5 follow-up (the adapter appends without a cap).

AFTER MERGE (Lane B continues, not the conductor): the parity walk. Beat-by-beat side-by-side, app preview vs gg-onboarding-render.pages.dev: same copy, order, reveal sequence, clips playing, captions synced. Plan: budget-gated Sonnet fan-out, one agent per beat, findings to a scratch dir, adjudicated findings posted as an MR note / status entry. That parity pass is the acceptance test of the whole consolidation (plan section: verification gates). After it: Yair's QA-perfect pass gates the promote.

ARTIFACTS AND PATHS:
- Worktree: ~/Developer/claude-work/gg-lane-b/mvp (branch lane-b/content). Refs: gg-lane-b/ref (1741d095 extracts), gg-lane-b/ref-de67 (de67b298 extracts incl. clipCaptions.ts), gg-lane-b/out-final (seeded json, seed-report.md, logs).
- Converter: scripts/flow-sync/seed-from-render.ts (on main). Caption ingest: scripts/flow-sync/ingest-captions.ts (on main). Both one-time tools; re-run only if the render re-records clips.
- Seed provenance: content sha 1741d095, seed sha de67b298 (freshness cert gg-spec/docs/onboarding-render-freshness-2026-07-06.md).

FOLLOW-UPS NOT MINE TO DECIDE: retiring the why-intro dead code; Sheet Beats Context rows for the two CUSTOM beats (the render session owns the Sheet catch-up; the code-side fallback entries landed in beatContexts.ts via !453); threading the six whisper-split caption entries to hand-polished word text if anyone ever renders caption words directly (today nothing does).

## 2026-07-06 (evening): GATES OPEN, THE SEED IS UP. Full Lane B stack in draft, awaiting conductor merges

- !444 MERGED (plus A1 narration driver, A2/A5 adapters, A4 component-owned all landed on main). The final schema added a close narration kind and mp3Asset timing close (adopting the Lane B review notes); clip resolution goes mp3Assets id join, then absolute path, then /voice/ob/<id>.wav.
- THE STACK (conductor merges bottom-up): !443 converter (rebased onto main, close-kind + null-guard updates) -> !452 assets (37 wav clips, 37/37 name-keyed captions spliced into openerCaptions.ts, 4 updated female art files) -> !453 content (designer-source seeded at de67b298, generated flows re-synced, 22 nodes).
- Verification on the content branch: npx vitest run src/onboarding-flow, 33 files, 288 tests, ALL GREEN. flow:sync validation clean.
- Structural notes riding !453 (review flags in its description): why-intro dropped with a one-line ENGINE_BEAT_SPECS backId fix (state-check backs to profile), close lines as narration kind close (advanced-frequency confirm converted, advanced-capture given an explicit bubble+close script), test fixtures updated to the seeded flow, step0 no-invention probe moved to the linear flows.
- REMAINING after the train merges: the side-by-side acceptance pass, app preview vs gg-onboarding-render.pages.dev, beat by beat (copy, order, reveal sequence, clips, captions). Planned as a budget-gated Sonnet fan-out per frugal-fable; that parity check is the acceptance test of the whole consolidation.
- Machine note: the Mac's disk hit 100% full (ENOSPC) mid-run; reclaimed ~4.4GB (npm cache + a partial install). Still tight for future heavy work.

## 2026-07-06 (later): gate 2 GO, !444 reviewed, converter aligned, captions ingested; ONE gate left

- Gate 2 SATISFIED: the freshness certificate landed. Content truth 1741d095, seed sha de67b298 (adds per-word captions). Verified: FlowDesigner/metadata/voiceClips byte-identical between the two shas.
- Schema review posted on !444 (note 3620) per the plan's reviewer role: contract approved from the Lane B side, six notes (key ones: narration clip ids resolve through the mp3Assets join, not a path convention; close/confirm lines stay props-driven, no narration slot, and the driver must treat trailing segments after the interaction point as completion lines).
- Converter aligned to the !444 contract and re-run at de67b298 (commit 89c4e7c6 on lane-b/seed-converter, !443): narration at beat top level, perElement carries clip ids. 26 beats, 38/38 clips, 0 problems. Delta vs the 1741d095 dry run is exactly the alignment changes.
- Job-1 flag closed: the ONBOARD-ADVANCED close line is carried explicitly (props.closeCoachLine verbatim + close mp3Asset with matching transcript).
- Captions (B4) ingested: new scripts/flow-sync/ingest-captions.ts maps clipCaptions.ts into the engine's openerCaptions.ts keyed by mp3Assets src path. 37/37, bidirectional check. No mlx-whisper needed. The six whisper-split clips are safe as-is (onsetsForDisplayWords maps token onsets to display words proportionally; caption word text is never displayed).
- Button ruled by the conductor: into-app keeps "Start".
- REMAINING GATE: !444 merged (pipeline red, being fixed by its lane). On merge: re-check the final schema shape, verify custom-entry wiring against the !444 sample beats, run flow:sync + parity, then the stacked content + assets MRs and the side-by-side acceptance pass vs gg-onboarding-render.pages.dev.

## 2026-07-06: read-only prep complete, converter draft MR up, BOTH GATES STILL CLOSED

### Gate status (checked 2026-07-06)

| Gate | State |
|---|---|
| 1. Lane A Step 0 schema MR merged | NOT MET. No schema MR exists yet (not even a draft; checked all open MRs). |
| 2. gg-spec/docs/onboarding-render-freshness-2026-07-06.md | NOT MET. File does not exist in gg-spec. |

Per the lane contract: no content committed, content branch not forked. Everything below is tooling and local dry-run artifacts.

### Done this session

- Converter (B1) built and pushed: MR !443 (draft, converter only, scripts/flow-sync/seed-from-render.ts on branch lane-b/seed-converter). Merge rules: render wins on spoken copy, narration, clips; base designer-source wins on engine wiring (nodeId, backId, persistStep, captureFields, tools, voice flags), contexts, sheetStage. Lints em dashes and UI verbs (tap/scroll/click/press/swipe) in spoken lines, verifies clips against the branch manifest, cross-checks BEATS props vs metadata narration (the A/B drift gotcha from the render handoff). Linter negative-tested (it fires).
- Dry run at render sha 1741d095 (the current remote tip of flow-annotated-render): 26 beats out, 38 of 38 clips resolved, 0 problems. Artifacts local at ~/Developer/claude-work/gg-lane-b/out/ (designer-source.seeded.json + seed-report.md), deliberately NOT committed.
- Hand review done beat by beat against handoff section 2: all narration sequences match (state-check 2 bubbles + 4 reveals, morning 2+3, reflection 1+7, fork 1+2, schedule 2 bubbles + reveal 99, advanced-frequency 3 bubbles + reveal 99, projections destreaked). All spoken copy verbatim to section 2.

### Structural decisions encoded in the converter (flag if wrong)

- why-intro (base beat 7) DROPPED: merged into state-check by the render; it carries no engine node, graph unaffected.
- qa-control (0) and weekly-day-setup (9b) PRESERVED from base; the render's 25 do not carry them. weekly-day-setup keeps its slot after reflection, before the fork (persistStep 9 wiring intact).
- category-women NOT emitted as a beat, per the Yair ruling (same screenId, render-time art switch by profile gender). The engine-side gender switch is Lane A territory.
- goal-custom (11b2) and habit-custom (11c2) added with PLACEHOLDER engine wiring; re-aligned to Lane A's Step-0 sample beats before the content MR goes ready.
- Step-0 field shape emitted: meta.narration segments {kind, n, say?, clip?}; mp3Assets with id + timing (opener|element|full-beat) + elementId for element clips; beat-level hideOrb + componentOwned. Placement centralized in FIELD_PLACEMENT (one edit to re-align to the landed schema).

### Open flags needing a ruling (details in MR !443 description)

1. into-app button label: render machine truth says "Start", handoff section 2 prose says "Approve and start". Machine truth emitted; the freshness doc should settle it.
2. close/confirm prop lines carry mp3Asset timing "opener" (the enum has no close slot); Lane A may want a timing value for close lines.
3. profile beat keeps base demo props (userReply, age "28", gender "Male"); verify they cannot preseed the age picker, no-age-default is locked.
4. 4 female art webp files are NEWER on the render tip than main (real art vs earlier drop); they ride the Lane B assets MR.

### Plan for when the gates open

1. Re-extract sources at the sha the freshness doc names (NOT 1741d095 by assumption), re-run the converter, re-review the delta only.
2. Align FIELD_PLACEMENT + custom-entry engine wiring to the landed Step-0 schema.
3. Content MR (stacked on !443): designer-source.json replaced by the seeded document, npm run flow:sync regenerates (no hand edits to generated files), parity tests.
4. Assets MR: 37 public/voice/ob/*.wav + splash_welcome.mp3 stays + the 4 updated female webp files. Clip refs live in the flow document (mp3Assets), no separate voiceClips map ports over.
5. Captions: per-word caption data for the clips exists with the render session (request already sent per plan B4: splashCaptions format keyed by clip id, pushed to the new GitLab). Ingest + convert on delivery; mlx-whisper only for clips the render session cannot supply.
6. Acceptance: side-by-side app preview vs gg-onboarding-render.pages.dev, beat by beat: same copy, order, reveal sequence, clips, captions.

No em dashes. Conductor merges; Lane B never self-merges.
