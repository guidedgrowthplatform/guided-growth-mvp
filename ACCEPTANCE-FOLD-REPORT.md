# Acceptance Fold Report

## Scope

- Replaced acceptance arrays for all **62/62** concrete onboarding beats in `src/components/flow-designer/beatsSource.ts` from the 19-section source of truth, `ACCEPTANCE-DEEPENING.md`.
- Retained the existing acceptance shape and narrowed `check` to `'harness' | 'manual' | 'db-probe'` in `src/components/flow-designer/flowBible.ts`.
- Updated the flow viewer Acceptance rail to render the check method as a tag.
- Flagged the two state-check atomic persistence rows with `PENDING-BACKEND-WIRING` for the state/habit/reflection three-way split review.
- Did not alter scripts, locked words, tools, persistence definitions, rules, or other beat content.

## Counts

| Beat | Before | After |
| --- | ---: | ---: |
| `onboarding-beat-1-splash` | 3 | 5 |
| `onboarding-beat-2-get-started` | 3 | 5 |
| `onboarding-beat-3-coach-greeting` | 3 | 6 |
| `onboarding-beat-4-sign-up` | 4 | 8 |
| `onboarding-beat-5-mic-permission` | 3 | 10 |
| `onboarding-beat-6-profile:greeting` | 3 | 6 |
| `onboarding-beat-6-profile:asks` | 4 | 10 |
| `onboarding-beat-7-state-check` | 3 | 10 |
| `onboarding-beat-8-morning-checkin-setup` | 3 | 9 |
| `onboarding-beat-9-evening-reflection-setup` | 4 | 11 |
| `onboarding-beat-10-experience-fork` | 4 | 10 |
| `onboarding-beginner-beat-11-pick-category` | 5 | 10 |
| `onboarding-beginner-beat-11-pick-category:women` | 5 | 10 |
| `onboarding-beginner-beat-12-pick-goals:sleep` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:move` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:eat` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:energy` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:stress` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:focus` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:break` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:organize` | 5 | 11 |
| `onboarding-beginner-beat-12-pick-goals:custom` | 3 | 11 |
| `onboarding-beginner-beat-13-pick-habits` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:fall-asleep-earlier` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:wake-earlier` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:sleep-consistently` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:sleep-deeply` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:walk-more` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:exercise-consistently` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:mobility` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:eat-intentionally` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:reduce-overeating` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:plan-food` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:morning-energy` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:avoid-crashes` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:stable-energy` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:calmer-day` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:evening-stress` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:less-overwhelmed` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:start-work` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:deeper-work` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:procrastinate-less` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:smoking` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:weed` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:alcohol` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:porn` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:phone-use` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:late-snacking` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:caffeine` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:stay-on-tasks` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:tidy-spaces` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:life-admin` | 5 | 11 |
| `onboarding-beginner-beat-13-pick-habits:custom` | 3 | 11 |
| `onboarding-beginner-beat-14-schedule-habits` | 3 | 9 |
| `onboarding-advanced-beat-15-capture-existing-habits` | 3 | 10 |
| `onboarding-advanced-beat-16-schedule-existing-habits` | 3 | 10 |
| `onboarding-beat-17-plan-review` | 3 | 12 |
| `onboarding-beat-18-week-projection:empty` | 3 | 9 |
| `onboarding-beat-18-week-projection:best` | 3 | 9 |
| `onboarding-beat-18-week-projection:likely` | 3 | 9 |
| `onboarding-beat-18-week-projection:some` | 3 | 9 |
| `onboarding-beat-18-week-projection:avoid` | 3 | 9 |
| **Total** | **270** | **636** |

Structural verification: **62/62** mapped, **636/636** rows use only `harness`, `manual`, or `db-probe`, and exactly **2** rows carry `PENDING-BACKEND-WIRING`.

## Gate Outputs

### `npm run type-check`

```text
> life-growth-tracker@2.1.0 type-check
> tsc --noEmit
```

### `npm run check:render`

```text
> life-growth-tracker@2.1.0 check:render
> node scripts/render-consistency-check.mjs

Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).
```

### `npm run check:links`

```text
> life-growth-tracker@2.1.0 check:links
> node scripts/render-link-integrity-check.mjs

Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.
```

### `npm run build:flow`

```text
> life-growth-tracker@2.1.0 build:flow
> vite build --config vite.flow.config.ts --base=/ && cp dist-flow/flow-standalone/index.html dist-flow/index.html && node scripts/export-render-parity.mjs

vite v5.4.21 building for production...
transforming...
✓ 2274 modules transformed.
rendering chunks...
computing gzip size...
dist-flow/flow-standalone/index.html      0.69 kB │ gzip:   0.39 kB
dist-flow/assets/index-ByXSXcVh.css      78.88 kB │ gzip:  13.38 kB
dist-flow/assets/index-C29ax9m6.js        0.35 kB │ gzip:   0.24 kB
dist-flow/assets/web-0U9QgoUY.js          1.25 kB │ gzip:   0.59 kB
dist-flow/assets/index-BLIYSym2.js    1,490.43 kB │ gzip: 251.24 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 7.03s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers
```

### `npm run verify:objective1`

```text
> life-growth-tracker@2.1.0 verify:objective1
> node scripts/verify-objective1.mjs

locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
```
