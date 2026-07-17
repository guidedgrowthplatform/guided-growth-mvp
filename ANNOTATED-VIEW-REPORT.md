# Annotated View + Objective 1 Verifier Report

## Scope completed

- Expanded the Onboarding annotated source rail in `src/components/flow-designer/FlowDesigner.tsx` without changing beat data or Play behavior.
- Every beat now renders these collapsible sections from `BEATS_SOURCE`: **Persistence**, **Tools**, **Script detail**, **Conversation**, **Acceptance**, and **Rules**.
- Absent data is shown as a compact `none` marker instead of leaving a section or cell blank.
- Added the portable committed locked-copy snapshot at `scripts/verify-objective1-baseline.json`.
- Hardened `scripts/verify-objective1.mjs` to print every locked-copy delta and require exactly the two sanctioned changes. It loads the committed snapshot first and falls back to `git show` only when a `.git` checkout exists.
- The verifier header documents that its locked projection intentionally covers verbatim user-facing copy only (script words plus component opener text); context and tool contracts are excluded because consolidation enriched them by design.

## Annotated sections by beat

All 62 beats display all six new sections. Values below state the real row/line counts. A zero is rendered as `none` in the panel.

| Beat | Persistence (in/out) | Tool specs | Script lines | Conversation branches | Acceptance pairs | Rules (context/code) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `onboarding-beat-1-splash` | 0 / 0 | 0 | 0 | 0 | 3 | 0 / 0 |
| `onboarding-beat-2-get-started` | 0 / 0 | 0 | 0 | 0 | 3 | 0 / 0 |
| `onboarding-beat-3-coach-greeting` | 0 / 0 | 0 | 1 | 0 | 3 | 2 / 3 |
| `onboarding-beat-4-sign-up` | 0 / 2 | 0 | 0 | 0 | 4 | 2 / 3 |
| `onboarding-beat-5-mic-permission` | 0 / 1 | 0 | 1 | 0 | 3 | 3 / 3 |
| `onboarding-beat-6-profile:greeting` | 1 / 0 | 0 | 1 | 0 | 3 | 3 / 3 |
| `onboarding-beat-6-profile:asks` | 0 / 2 | 2 | 2 | 4 | 4 | 3 / 4 |
| `onboarding-beat-7-state-check` | 0 / 1 | 2 | 5 | 0 | 3 | 3 / 4 |
| `onboarding-beat-8-morning-checkin-setup` | 0 / 1 | 2 | 5 | 0 | 3 | 3 / 5 |
| `onboarding-beat-9-evening-reflection-setup` | 0 / 2 | 3 | 8 | 5 | 4 | 4 / 5 |
| `onboarding-beat-10-experience-fork` | 0 / 1 | 3 | 3 | 4 | 4 | 4 / 5 |
| `onboarding-beginner-beat-11-pick-category` | 1 / 1 | 2 | 3 | 4 | 5 | 7 / 7 |
| `onboarding-beginner-beat-11-pick-category:women` | 1 / 1 | 2 | 3 | 4 | 5 | 7 / 7 |
| `onboarding-beginner-beat-12-pick-goals:sleep` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:move` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:eat` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:energy` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:stress` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:focus` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:break` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:organize` | 1 / 1 | 2 | 1 | 4 | 5 | 8 / 9 |
| `onboarding-beginner-beat-12-pick-goals:custom` | 1 / 1 | 2 | 1 | 0 | 3 | 3 / 3 |
| `onboarding-beginner-beat-13-pick-habits` | 1 / 1 | 3 | 2 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:fall-asleep-earlier` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:wake-earlier` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:sleep-consistently` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:sleep-deeply` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:walk-more` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:exercise-consistently` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:mobility` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:eat-intentionally` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:reduce-overeating` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:plan-food` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:morning-energy` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:avoid-crashes` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:stable-energy` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:calmer-day` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:evening-stress` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:less-overwhelmed` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:start-work` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:deeper-work` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:procrastinate-less` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:smoking` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:weed` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:alcohol` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:porn` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:phone-use` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:late-snacking` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:caffeine` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:stay-on-tasks` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:tidy-spaces` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:life-admin` | 1 / 1 | 3 | 1 | 4 | 5 | 9 / 8 |
| `onboarding-beginner-beat-13-pick-habits:custom` | 1 / 1 | 2 | 1 | 0 | 3 | 3 / 3 |
| `onboarding-beginner-beat-14-schedule-habits` | 1 / 1 | 3 | 3 | 0 | 3 | 3 / 6 |
| `onboarding-advanced-beat-15-capture-existing-habits` | 1 / 1 | 2 | 3 | 4 | 3 | 5 / 5 |
| `onboarding-advanced-beat-16-schedule-existing-habits` | 1 / 1 | 3 | 4 | 0 | 3 | 3 / 6 |
| `onboarding-beat-17-plan-review` | 3 / 1 | 1 | 1 | 2 | 3 | 3 / 4 |
| `onboarding-beat-18-week-projection:empty` | 1 / 0 | 0 | 1 | 0 | 3 | 2 / 3 |
| `onboarding-beat-18-week-projection:best` | 1 / 0 | 0 | 1 | 0 | 3 | 2 / 3 |
| `onboarding-beat-18-week-projection:likely` | 1 / 0 | 0 | 1 | 0 | 3 | 2 / 3 |
| `onboarding-beat-18-week-projection:some` | 1 / 0 | 0 | 1 | 0 | 3 | 2 / 3 |
| `onboarding-beat-18-week-projection:avoid` | 1 / 0 | 0 | 1 | 0 | 3 | 2 / 3 |

## Gate outputs

```text
$ npm run type-check
> tsc --noEmit
PASS

$ npm run check:render
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).

$ npm run check:links
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.

$ npm run build:flow
✓ 2274 modules transformed.
✓ built in 6.88s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers

$ npm run verify:objective1
locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
```

`build:flow` emitted Vite's existing large-chunk advisory; the build completed successfully.
