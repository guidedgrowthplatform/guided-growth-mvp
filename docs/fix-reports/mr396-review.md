# MR !396 review — feat/onboarding-coach-card-fill (Track 2, card fill)

Reviewed 2026-07-02 against the bugfix plan v2.3's verified findings (Loop 2 scope), the
generated V3 flow, and staging tip b49d4987. Author: jamymarcoss47. Verdict: **sound, stack
Loop 2 on it** — the fill wiring is exactly the missing half of B20's card path and none of
it conflicts with Loop 2's resume rewrite. Gaps and risks below.

## What it fixes (verified in the diff)

1. **B20 card-fill wiring** — `toolEventToVoiceActions.ts` gains the four missing cases:
   `record_checkin` → `record_checkin` (sleep/mood/energy/stress, number-typed),
   `submit_morning_checkin` → `set_morning_checkin`, `add_habit`/`update_habit` → also
   `set_habit_schedule`, `submit_custom_prompts` → `set_reflection_config {mode:'prompts'}`.
   Card listeners already existed (StateCheckAdapter listens `record_checkin`, ScheduleCard
   `set_morning_checkin`); ReflectionAdapter gains the `prompts` fill. Covered by tests at
   all three layers (mapping, hook fan-out, adapter bus → onCapture).
2. **ProfileAdapter auto-submits** when the voice fill completes the card (age + gender both
   present) — capture flows through the orchestrator, tap-equivalent. Partial fills wait.
3. **Profile gate un-strands users** — nickname now optional everywhere (handler, schema,
   `preconditions.ts` case 1 now age+gender, canonicalOptions), consistent on the shared
   Vapi `navigateNext` path; reconcile tests updated.
4. **Tool gate is export-driven** — `beatContexts.ts` overlays per-beat `allowedTools` from
   `src/generated/onboarding_combined.json` (`meta.fill.allowedTools`), filtered through
   `isOnboardingToolName`. First runtime consumer of the combined file. Only behavior
   change vs code-owned lists: ONBOARD-COMPLETE gains `update_habit`.
5. **No literal `{name}`** — server-side `fillBeatName` substitution in buildSystemPrompt
   (onboarding-only, after `stripForwardPointers` — checked: does not re-gate the
   sanitizer, Gotcha #10 intact).
6. **B18 landmine partially cleared** — untracks the committed `node_modules` symlink
   (mode 120000 → gone) and fixes `.gitignore`. When !396 merges, staging loses the
   dangling machine-local symlink. B18's owner still wants the CI guard
   (`git ls-files node_modules` must be empty) so a diverged branch can't re-merge it.

## What it misses (stays in Loop 2, landing stacked on this branch)

1. **Beat completion on voice saves (the other half of B20).** The fill lands on the card,
   but a voice-only save still doesn't advance the beat: `record_checkin` /
   `submit_morning_checkin` are not in `BEAT_COMPLETING_TOOLS`, their handlers never bump
   `current_step` on UPDATE, and the model's `advance_step` (old-ladder targets) can't
   legally reach 6/7 from a current_step of 1-2. User must tap Continue after speaking.
2. **The post-fork bump is a no-op (dead air after the path answer, B4's dead-air facet).**
   `useChatToolEvents`' optimistic advance computes `stepForScreenId(screen)+1` clamped by
   `Math.max(prev, target)` — but the tap path pins `current_step = GREATEST(...) ≥ 8` once
   the pre-fork beats saved, so every post-fork target (fork 3, category 4, goals 5,
   habits 6) sits below the pin and the bump never fires; the orchestrator's leading-edge
   watch never sees a climb. Loop 2 makes the bump strictly increasing, guarded by a
   tool→beat map so a tool that raced past its beat can't skip the next one.
3. **The four stale step maps** (systemPromptAddendum ladder, preconditions cases 6-8,
   STEP_TO_SCREEN_ID, SCREEN_TO_STEP/beatForStep) are untouched — Loop 2 remaps them to the
   V3 persist scale with a flow-derived parity test.
4. **B9/B10 resume** — already landed on Loop 2's branch (!398, evidence-driven
   `resumeFromServerRow`).

## Risks / notes

- **allowedTools overlay REPLACES code-owned tools** (their own "still open" note). Safe
  with today's export, but a builder beat that drops `advance_step` becomes silently
  un-advanceable. Loop 2 picks up the cheap union guard while in the file.
- **Behavioral trap when completion wiring lands:** `submit_custom_prompts` is already in
  `BEAT_COMPLETING_TOOLS` (legacy). Once the bump actually fires (Loop 2's fix), a
  custom-prompts save would complete the whole reflection beat before the schedule is set.
  Loop 2 removes it from the completing set (mid-beat save; reflection completes on
  `submit_reflection_config`).
- **API bundle path:** `beatContexts.ts` (under `api/_lib`) imports
  `../../../../src/generated/onboarding_combined.json` with import attributes. tsc + tests
  pass; Vercel's node-file-trace should follow a static JSON import outside `api/`, but
  this exact lane (runtime serverless) is unproven — the preview run must exercise one
  `/api/llm` call on a beat whose tools come from the export (e.g. ONBOARD-COMPLETE)
  before !396 merges.
- **Age is now hard-required to leave profile** (was: nickname+gender). Tap path always
  supplies age (picker default); a voice user who only states gender gets `age_missing`
  until the model re-asks. Acceptable, but the addendum's field-capture pattern should
  keep teaching age extraction (it does).
- **Combined-file cycle risk** (their handoff): `onboarding_combined.json` is generated by
  `scripts/build-onboarding-combined.ts`; `beatContexts` must never write into it, and
  nobody hand-edits it. Standing rule 7 updated in plan v2.3 to match.
- **Prettier churn** in `designerToFlow.ts` is real reflow only — verified no logic change
  (two functions reverted to module-private, same bodies).

## Interplay with Loop 2's landed resume rewrite

- Profile completion evidence in `resumeFromServerRow` is `data.gender != null` — still
  correct under nickname-optional (age+gender gate ⇒ gender present iff beat passed).
- `serverCaptureForBeat`'s state-check replay reads `data.stateCheck ?? data.checkin` —
  matches what `recordCheckin` writes; no conflict.
- No file overlap between !396 and Loop 2's committed work (`useFlowOrchestrator.ts`,
  flow tests). Stacking merge is clean.
