# Lane B STATUS: content + assets migration (onboarding consolidation)

Lane B of gg-spec/docs/onboarding-consolidation-plan-2026-07-06.md. One-time seed, render to flow builder/engine; after the seed the flow builder is the source of truth. Newest entry on top.

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
