# Render Bugs Report

## Fixed

- **Plan-confirm Play rendering:** `runBeatScript` now finishes each narrated beat by revealing render-only steps. The plan-confirm beat therefore holds the complete `into-app` surface in Play: `YOUR PLAN`, morning check-in, every habit, evening check-in, evening reflection, their day-pickers, and both existing CTAs.
- **Plan-review CTAs:** the existing component already uses the requested labels: `Approve and start` and `I want to change something`. No locked source copy was edited.
- **Women-art selection:** Play now owns a shared flow state across beats. Selecting `Female` in profile persists the gender and filters the Play sequence so `onboarding-beginner-beat-11-pick-category:women` is rendered instead of the default category beat. Male and Other render the default category beat. Annotated continues to display both variants for review.
- **Advanced frequency:** Play now keeps the captured-habit collection when it advances between beats. Advanced capture supplies five habits, and advanced frequency maps every captured habit to its own `HabitScheduleCard` and day-picker, as required by the beat contract.
- **Projections:** the `p78` and `p36` card headlines now pass 78 and 36, respectively, to `WeeklyHabitsSummary`, matching the beat names and recorded clip identifiers `onboard_weekly_projection_p78_1` and `onboard_weekly_projection_p36_1`. Locked `beatsSource.ts` copy was not changed.

## Reported For Decision

- **None.** The current `onboardingComplete.tsx` implementation and the source props already contain both requested CTAs. Although later prose in `beatsSource.ts` describes a one-button read-only migration target, changing it was not necessary for this render repair and would have risked changing locked copy.

## Gate Outputs

- `npm run type-check` — passed.
- `npm run check:render` — passed: `Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).`
- `npm run check:links` — passed: `Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.`
- `npm run build:flow` — passed; exported `dist-flow/parity.json` with 62 beats.
- `npm run verify:objective1` — blocked by this consolidated worktree lacking `.git`. The script invokes `git show 9c0019f70560e4aa8ffa995f808315b4c87b4857:src/components/flow-designer/beatsSource.ts` and exits with `fatal: not a git repository`. No locked-copy source was edited in this repair, so the expected locked-copy delta remains the pre-existing count of 2, but that count cannot be independently executed in this environment.
