# Onboarding QA, full-angle sweep (2026-06-27)

Six parallel QA passes over the flow-builder onboarding, each from one angle:
emotional / feeling held, copy / voice, visual consistency, motion / transitions,
flow coherence, technical / code health. About eighty raw findings, deduped into
the themes below and ranked. Every item cites the file so it is actionable.

Severity bands:
- **P0** rule violations, broken behavior, or data that never reaches the user.
- **P1** high-impact experience and the things you can feel.
- **P2** consistency and maintainability.

---

## P0, fix first

> Status update (commit `17def0c8`, home-tour build): items **3, 4, 5 are CLOSED**.
> Item 3 (advanced capture dead end) was already closed earlier (advancedCapture lifts
> `flow.setHabits`). Item 4 (schedule times never persist) is closed: FlowState now carries
> `morningTime` / `eveningTime` / `habitConfigs`, the schedule + morning + evening beats lift
> them, and the recap + home tour read them. Item 5 (plan-cards back points forward) is fixed
> (now targets the habit step). Items 1, 2, 6 (copy / voice-pushes-UI / canvas-vs-runtime)
> remain open.

**1. Em dashes in live coach copy.** `src/components/onboarding/onboardingOpeners.ts`
has 13+ em dashes in user-facing openers, plus `beats/reflectionCard.tsx:96`
("speak freely, no prompts"). These ship to real users and break the hard ban,
and Cartesia may read the dash as a literal pause or word. Replace each with a
comma or a period. [copy]

**2. Coach lines push the UI.** The state-check line ("Tap what fits") and the
habit-schedule line ("Set a time and how often") tell the user to operate
controls instead of guiding by voice. This breaks the voice-never-pushes-UI rule.
Rewrite so the card does the prompting, not the coach. [emotional, copy]

**3. Advanced capture writes hardcoded sample data.** `beats/advancedCapture.tsx`
always writes five fixed sample habits and never takes real input, so an advanced
user's captured habits never reach the schedule, the confirm screen, or the
recap. The captured list is a dead end. [flow, technical]

**4. Schedule times never persist.** `morningCheckinSetup` and `reflectionCard`
hold the time in local state and never lift it to `flowStateCtx`, so `plan-cards`
and the into-app recap always show hardcoded times (8:00 AM / 9:30 PM), not what
the user set. Add `morningTime` / `eveningTime` / `habitConfigs` to FlowState.
[flow, technical]

**5. plan-cards back target points forward.** `ENGINE_DEFAULTS['plan-cards'].backId`
is `reflection-setup`, a beat that appears AFTER plan-cards, so Back jumps the
user forward. Point it at the habit step. [flow]

**6. Canvas shows different copy than runtime.** Beat fallbacks diverge from the
FlowBuilder props for advancedCapture, planCards, onboardingComplete, stateCheck,
and profile (the profile fallback even drops `{name}`). The static canvas plays
the fallback, so QA-ing on the canvas does not match what users hear. Align the
fallbacks to the props. [copy]

---

## P1, the experience

**7. The orb renders at different sizes (the thing you flagged).** Root cause is
the ring spread, not just the body. `SplashIntro` passes no `ringStep` so it
falls back to DualButton's default of 28, `MicPermission` passes 7, and the dock
`BeatOrb` uses 4. Body sizes are also 150px full-screen vs 56px docked. So the
same orb has a 234px outer ring on splash, 171px on mic-permission, 80px docked,
back to back. Pick one proportional ring ratio and one body-size logic.
[visual]

**8. The coach opens with an apology.** The splash greeting starts "I might have
startled you... you're probably not used to an app just talking to you" and says
"at your service." The first 30 seconds start from a deficit. This is recorded
audio, so it needs a re-record. Lead with calm presence instead. [emotional]

**9. The two biggest moments land flat.** plan-cards ("Do these look right, or
want to change anything?") reads like a checkout confirm, and the into-app closer
("You're all set. Let's get started.") is the most generic line in the product,
right after the user's biggest investment. Reflect their plan back instead.
[emotional]

**10. Motion is not one language.** A spoken bubble fades in 150ms while its card
fades in 520ms, so every structured beat reveals at two speeds. The post-line
dwell is uncapped and grows past 2s on long lines, which reads as frozen. List
staggers differ (950ms scan vs 500ms review). The orb uses a spring curve in one
beat and a precision ease in the next. Unify to a shared set: word 150ms, reveal
300ms, stagger 600ms, transition 450 to 500ms, one orb curve. [motion]

**11. The name is captured then dropped.** It is used once (profile) and never
again across beats 7 to 15. Add `{name}` to a couple more spots (the plan and the
closer). [emotional]

**12. Splash audio line is broken and verbose.** "here at your service at Guided
Growth" has two "at" phrases, and "excited to help you improve things in your
life" is generic. Re-record clean, once, together with item 8. [copy]

---

## P2, consistency and maintainability

**13. Two different toggles.** `morningCheckinSetup` hand-rolls a bespoke amber
switch while `reflectionCard` uses the shared `Toggle`. Same affordance, adjacent
beats, different look and missing aria-label on the bespoke one. Give `Toggle` an
accent prop and use it in both. [visual, technical]

**14. Tokens not shared.** Card radii are 16 / 20 / 24 across beats, card shadows
use four different formulas, the `FONT` string is copy-pasted in seven beat files,
and most beats hardcode `#fff` and rgb blues instead of design tokens (only
stateCheck uses tokens, so only it would survive dark mode). Extract a
`beatTokens.ts` and move card wrappers to tokens. [visual, technical]

**15. Copy label inconsistencies.** "Evening Reflection" (title case) vs "Morning
check-in" (sentence case); the style option "Freeform" shows a heading "Open mic";
"When?" here vs "Check-in time" there for the same TimePicker; "Remind me" reads
like a button not a toggle label; stray exclamation marks ("Create your own
habit!", "Deep!", "Awesome!"). Pick one register and apply it. [copy]

**16. State and effect risks.** `habitSchedule` builds `cfgs` from a lazy
initializer that never re-runs, so changing the habit set on a replay shows stale
defaults; `advancedCapture` and `BeatPlayer` capture `flow` / `steps` in effects
with suppressed deps (stale-closure risk); a few React keys use the index or an
icon string; qaControl uses `div role=button` with no keyboard handler. [technical]

**17. Beat-to-beat transitions are all an unauthored 600ms dissolve,** and
`BeatTransition` applies `ease-out` to all nine kinds (slides and zooms want their
own easing). Seed intentional transitions on the flow. [motion]

---

## Root themes (the patterns under the findings)

- **Canvas vs runtime split** keeps producing two sources of truth (copy in beat
  fallbacks vs FlowBuilder props; sample data vs real flow state).
- **Captured data is not lifted to FlowState** (advanced habits, schedule times,
  profile, state-check selections), so downstream beats show placeholders. This is
  the same gap the app-shell handoff is about: the real home page plus engine work
  is where this gets wired end to end.
- **No shared tokens or motion constants**, so every beat re-invents font, color,
  radius, shadow, and timing, and they drift.
- **Bespoke vs real components**: the beats that reuse the real app components
  (habitSchedule, habitReview, habitPicker, categoryGrid) are the consistent ones;
  the hand-rolled ones (morning toggle, plan cards, choice cards) are where the
  drift lives.

## Suggested fix waves

1. **Wave A (rules + breaks):** items 1, 2, 5, 6. Fast, mechanical, high value.
2. **Wave B (the felt experience):** items 7, 9, 10, 11 plus the copy rewrites in
   2 and 9. The orb ring fix and the motion constants are the biggest visible wins.
3. **Wave C (connect the data):** items 3, 4, 16. This overlaps the app-shell work
   (lifting captured data to FlowState).
4. **Wave D (polish):** items 13, 14, 15, 17, plus the audio re-records (8, 12).

Build status at audit time: vite build passes; tsc clean except pre-existing
`.stories.tsx` errors.
