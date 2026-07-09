PLEASE INJECT IN THE YONAS BUILD SESSION (AI): 12-section Bible fill, all onboarding beats.

**Role.** You are the build session that fills every onboarding beat to the 12-section Bible contract in the render source. Yair approved the shape on a live sample. Your job is to scale that exact shape to all beats. Do not redesign it.

**Model/effort:** Opus, high effort.

**The approved shape and where it lives.**
- Repo guided-growth-mvp (self-hosted GitLab, gitlab.guidedgrowthapp.com). Branch `annotate/sample-category-women` off `render/collapse-variants`. Worktree at ~/Developer/claude-work/gg-annotate-sample (or add your own from it).
- The sample beat `category-women` in `src/components/flow-designer/beatsSource.ts` carries the full `bible` field (all 12 sections). That is your EXACT template, match its structure and depth per beat.
- The schema already exists: `BeatEntry.bible?: BibleSections` plus the type tree (BibleKV, BibleAlias, BibleScriptMeta, BibleRule, BibleToolSpec, BibleEdge, BibleAcceptance, BibleDecision). The annotated UI (`FlowDesigner.tsx`, BiblePanel) already renders it. Live sample: https://bfec93c4.gg-onboarding-render.pages.dev (category-women, order 12).

**Task.** Populate the `bible` field for EVERY onboarding beat in beatsSource.ts on this branch (the collapsed concept beats), each to all 12 sections plus applicable-decisions, so each renders in the BiblePanel like category-women. Fill beat 13 (order 13) among the FIRST so the human review has a concrete non-sample beat early. Also:
- CREATE the NEW per-habit-acknowledgment beat first (it does NOT exist in beatsSource.ts yet, only its copy and clips do). Add the beat entry (identity, script from the ack doc + the !527 clips, flow: after a habit is picked, once per picked habit up to 2, before the schedule beat), THEN fill its 12 sections. Engine resolves the clip by picked habit id to `onboard_habit_ack_<slug>`; shared-habit ids map to one shared clip; custom or freeform habit falls to `onboard_habit_ack_custom_fallback.wav`.
- Land the 4 re-record script edits in beatsSource `script[]` (rows 14, 67, 68, 71).

**Ground every section in (read these).**
- The Bible spec, the 12-section definitions and shapes: gg-spec/docs/render-bible-spec-and-gap-audit-2026-07-09.md
- Locked rules and decisions: gg-spec/docs/rules-enforceability-law-2026-07-09.md, onboarding-behavior-decisions-2026-07-09.md (the 7 engine decisions), onboarding-coach-per-beat-2026-07-09.md (archetypes A/B/C/D, which sections it writes, and the tool corrections), onboarding-copy-flow-rules.md (including new rules 27-29 for the ack layer), weekly-projection-rules-APPROVED-2026-07-09.md (for any weekly or projection beat).
- The 9 coach evals for section 5 enforcedBy: eval:verbatim-opener, no-read-options, no-praise-pick, no-contrarian-turn, no-platitudes, name-the-goal, one-line-then-wait, single-select, stay-open-unsure. Sections 7, 11, 12 use eval:parity-walk and eval:edge-walk.
- Final copy: gg-status/scratch/copy-drops.md (the re-records and the ack layer). Use FINAL copy where locked. Mark [COPY-PENDING] only where genuinely not final.
- Clips: MR !527 (branch feat/onboarding-habit-ack-audio) has the 114 clips in public/voice/ob/ (onboard_habit_ack_<slug> and the 4 re-records). Reference them in voice and script. Do not regenerate.

**Hard rules.**
- enforcedBy is NEVER null. Nothing prose-only. Use real enforcer ids: the eval:* ids above plus existing static-check basenames (id-alias-check, reveal-timing-check, component-registry-check, audio-ownership-check, persistence-contract-check, advance-gate-check, decisions-coverage-check, tool-contract-check, render-link-integrity-check, type-check).
- Ground components, voice, tools, persistence, and flow in what beatsSource and the docs actually say. Do not fabricate. Tools: habits use add_habit / remove_habit, schedule uses add_habit / update_habit, category uses submit_category, fork uses ask_clarification. No submit_habits or submit_goals.
- App-side unknowns (which table a write lands in, the gender-routing code path) get FLAGGED for app-reconcile, not invented.
- The sample's 6 watch-outs apply everywhere: beatId is the unique key so look up bible by beat.id, not screenId (category and category-women share ONBOARD-BEGINNER-01); a clip bound from two beats is valid, not a duplicate error; confirm the submit_category enum against beat_contexts.json; confirm eval:parity-walk and eval:edge-walk are registered in the fleet or flag them.
- Scope is the beats on this branch (onboarding). The other-flow beats arrive via the combine (all-flows). Fill those after the combine, and note them.

**Where each section's data comes from (read this first).** A data-accessibility audit mapped every section to its real source: gg-status/scratch/fill-data-source-map.md . Use it as your pull guide. Confidence is MOSTLY: most sections fill directly (identity, script, voice, context prose, rules.context from the coach-per-beat doc, applicable-decisions, weekly acceptance numbers) or derive cleanly (rules.code from the 7 decisions, flow from the context "BRANCH THIS SETS UP" lines, edges from global + per-beat DO-NOTs, reveal/timing from bindsTo). The genuinely NOT-accessible items are all app-side and get `pending:true` / app-reconcile flags, NEVER invented, exactly as the category-women template does: persistence table+columns, per-tool arg schemas (incl the submit_category 8-label enum, beat_contexts.json is names-only), enforcer registration reality, exact on-screen tile state, vapiAgent layer, persisted alias values. If in doubt, flag it, do not fabricate.

**Output.**
- Work on a branch off annotate/sample-category-women (for example annotate/bible-fill-all). Fill all beats.
- Verify they render in the annotated view with no console errors, deploy a preview, open a DRAFT MR. Do NOT self-merge. The human structure review and the Fable pass gate it.
- Report progress to the ai-yonas channel with the preview URL and the draft MR, per batch of beats, so the human review can track each beat as APPROVE / CHANGE / GAP.

**Where this sits.** Human structure review runs alongside you (pass 1). After the full fill, Fable plus the humans do the final pass (pass 2). Your fill does not wait on the humans, but it is not merged until those gates clear.
