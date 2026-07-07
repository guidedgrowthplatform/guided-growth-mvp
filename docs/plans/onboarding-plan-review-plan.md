# Onboarding PLAN REVIEW and EDIT screen (ONBOARD-COMPLETE)

Post-stable, additive, not launch-blocking. Targets main; conductor merges after the
stable release is locked. NEVER self-merge.

## Goal

Turn the terminal ONBOARD-COMPLETE beat (today just a "Let's go" CTA) into a real plan
review: show the whole plan the user just built (habits + schedules, morning check-in,
evening reflection, weekly review day), let them edit the habits (remove, change a
frequency or time, add), then commit. Founder ruling: mid-flow beats are schedule-only
(MR !495); ALL plan editing happens here.

## Where it lives

The `into-app` adapter (screenId `ONBOARD-COMPLETE`) in
`src/onboarding-flow/renderer/componentRegistry.tsx`. No flow-structure change, no new
beat. The beat's `nextId` already points at the weekly-projection frames, so "Let's go"
advances into those frames and completion fires after the last one.

## What is editable

`allowedTools` for ONBOARD-COMPLETE (MR !495) = `add_habit, remove_habit, update_habit,
confirm_plan`. Habits are the editable entity (add / remove / change days+time+reminder).
The rituals (morning check-in, evening reflection, weekly day) are display-only here;
their editing happened at their own beats.

## Persistence path (decision)

Direct client `saveStep` (the same path every onboarding card tap uses), NOT the LLM
tools. Rationale:

- `saveStep` (PUT /api/onboarding) shallow-merges `data` per top-level key, so passing a
  full `habitConfigs` map replaces it wholesale, and `current_step = GREATEST(...)` never
  rewinds. This is exactly add / remove / change semantics.
- The gated LLM tools (add_habit/remove_habit/update_habit) remain the VOICE path; they
  write the same `data.habitConfigs` shape server-side.

Every edit updates BOTH:

1. Machine `answers` via a new orchestrator `patchAnswers(patch)` (merge, no advance).
   This keeps `deriveFinalData(answers)` correct so the final `complete()` write (which
   re-materializes `user_habits` from merged `data.habitConfigs`) is not clobbered by
   stale answers.
2. `serverData` via `saveStep` (survives refresh; resume lands back at ONBOARD-COMPLETE
   and rebuilds `answers` from `serverData`).

Voice edits at review reach `answers` through the same `useOnboardingVoiceActions`
listener pattern every other beat uses (server already persisted via the tool).

## Reuse

- `PlanSummaryCard` for every plan row (typeLabel widened to `string`, additive).
- `DailyReflectionCard` variant `schedule` for the per-habit time+days+reminder editor.
- `DayPicker`, `formatCadence`, `inferSchedule`, `formatTime12`, `MAX_HABITS_ONBOARDING`.
- Add-habit reuses the `OnboardingInput` + default-config add pattern (CustomEntryAdapter).

## Files

- `renderer/planReviewData.ts` (NEW, pure) - habit rows, path cap, map transforms.
- `renderer/PlanReview.tsx` (NEW) - presentational review + edit UI, callback-driven.
- `renderer/PlanEditContext.tsx` (NEW) - provides `patchAnswers` to the adapter.
- `renderer/componentRegistry.tsx` - `IntoAppAdapter` renders `PlanReview` + wiring.
- `useFlowOrchestrator.ts` - add `patchAnswers`.
- `renderer/FlowRenderer.tsx` - provide `patchAnswers` via context.
- `components/onboarding/PlanSummaryCard.tsx` - widen `typeLabel` to `string`.

## Edge cases

- Empty plan (no habits): show an empty note, add still available.
- Advanced (braindump) path: cap is the generous safety ceiling, not 2.
- Habit cap: disable add at the path cap (beginner 2), surface a note; matches server cap.

## Evidence gate

Unit tests (pure helpers + jsdom PlanReview: render, remove, add, change, cap, empty,
advanced) + full suite + tsc green + a live acceptance on a CI-built preview.
