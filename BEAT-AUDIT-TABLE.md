# Beat Audit Table — human review (July 17, 2026)

**Scope.** This is a read-only inventory of all 62 `BEATS_SOURCE` entries in source/play order. “BASE” means an entry with no `parent`; “VARIATION” means an entry with a `parent`. Line citations point to the entry’s `id` in `src/components/flow-designer/beatsSource.ts`.

| # | id | BASE BEAT or VARIATION (of which base) | one-line purpose | flags |
|---:|---|---|---|---|
| 0 | `onboarding-beat-1-splash` (source: `beatsSource.ts:112`) | BASE BEAT | Shows the silent branded splash before onboarding begins. | ODDITY — separate from the following silent “Get started” affordance; review whether both are needed. |
| 1 | `onboarding-beat-2-get-started` (source: `beatsSource.ts:278`) | BASE BEAT | Shows the single tap that moves from the brand frame into onboarding. | ODDITY — paired with the preceding splash, creating two pre-conversation structural beats. |
| 2 | `onboarding-beat-3-coach-greeting` (source: `beatsSource.ts:444`) | BASE BEAT | Plays the coach’s introductory greeting and auto-advances. | — |
| 3 | `onboarding-beat-4-sign-up` (source: `beatsSource.ts:695`) | BASE BEAT | Collects Apple, Google, or email sign-in. | — |
| 4 | `onboarding-beat-5-mic-permission` (source: `beatsSource.ts:965`) | BASE BEAT | Requests microphone access, with an Allow/Not now choice. | — |
| 5 | `onboarding-beat-6-profile:greeting` (source: `beatsSource.ts:1257`) | VARIATION of `onboarding-beat-6-profile` | Plays an auto-advancing profile introduction. | MISSING-BASE — parent has no entry; likely a deliberate two-part profile structural split, but it is not represented by a base entry. ODDITY — same `profile-beat` type as the following input beat. |
| 6 | `onboarding-beat-6-profile:asks` (source: `beatsSource.ts:1525`) | VARIATION of `onboarding-beat-6-profile` | Collects age and gender by voice or tap. | MISSING-BASE — parent has no entry; likely a deliberate two-part profile structural split, but it is not represented by a base entry. ODDITY — greeting and intake are separate ordered records under one absent parent. |
| 7 | `onboarding-beat-7-state-check` (source: `beatsSource.ts:1931`) | BASE BEAT | Captures initial sleep, mood, energy, and stress check-in values. | — |
| 8 | `onboarding-beat-8-morning-checkin-setup` (source: `beatsSource.ts:2376`) | BASE BEAT | Sets the morning check-in time and days. | — |
| 9 | `onboarding-beat-9-evening-reflection-setup` (source: `beatsSource.ts:2828`) | BASE BEAT | Sets evening reflection style, prompts, and time. | — |
| 10 | `onboarding-beat-10-experience-fork` (source: `beatsSource.ts:3428`) | BASE BEAT | Routes the person to beginner setup or existing-habit setup. | — |
| 11 | `onboarding-beginner-beat-11-pick-category` (source: `beatsSource.ts:3856`) | BASE BEAT | Beginner selects one life category to work on. | ODDITY — has one separately ordered artwork variation, so this is a conditional screen rather than a wholly independent next beat. |
| 12 | `onboarding-beginner-beat-11-pick-category:women` (source: `beatsSource.ts:4364`) | VARIATION of `onboarding-beginner-beat-11-pick-category` | Shows the same category picker with `female` artwork. | ODDITY — a presentation-only artwork variant occupies its own play-order slot; confirm it is conditionally substituted, not played after #11. |
| 13 | `onboarding-beginner-beat-12-pick-goals:sleep` (source: `beatsSource.ts:4873`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Sleep better” is selected. | MISSING-BASE — no goals base entry exists. Likely a variant-only representation keyed by selected category, but confirm that this is intentional. |
| 14 | `onboarding-beginner-beat-12-pick-goals:move` (source: `beatsSource.ts:5364`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Move more” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 15 | `onboarding-beginner-beat-12-pick-goals:eat` (source: `beatsSource.ts:5856`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Eat better” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 16 | `onboarding-beginner-beat-12-pick-goals:energy` (source: `beatsSource.ts:6348`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Feel more energized” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 17 | `onboarding-beginner-beat-12-pick-goals:stress` (source: `beatsSource.ts:6841`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Reduce stress” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 18 | `onboarding-beginner-beat-12-pick-goals:focus` (source: `beatsSource.ts:7333`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Improve focus” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 19 | `onboarding-beginner-beat-12-pick-goals:break` (source: `beatsSource.ts:7825`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Break bad habits” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 20 | `onboarding-beginner-beat-12-pick-goals:organize` (source: `beatsSource.ts:8317`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Picks one or two goals after “Get more organized” is selected. | MISSING-BASE — no goals base entry exists; likely category-conditional structure, confirm. |
| 21 | `onboarding-beginner-beat-12-pick-goals:custom` (source: `beatsSource.ts:8808`) | VARIATION of `onboarding-beginner-beat-12-pick-goals` | Captures a user-written goal instead of a category goal list. | MISSING-BASE — no goals base entry exists. ODDITY — switches from `goals-list` to `custom-entry`, so it may be a different interaction, not merely a visual variation. |
| 22 | `onboarding-beginner-beat-13-pick-habits` (source: `beatsSource.ts:9132`) | BASE BEAT | Picks habits appropriate to the selected goal(s). | ODDITY — one conceptual picker has 30 separately ordered goal/custom variants; do not interpret these as a 31-screen serial sequence without confirming routing. |
| 23 | `onboarding-beginner-beat-13-pick-habits:fall-asleep-earlier` (source: `beatsSource.ts:9645`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Fall asleep earlier” goal. | — |
| 24 | `onboarding-beginner-beat-13-pick-habits:wake-earlier` (source: `beatsSource.ts:10143`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Wake up earlier” goal. | — |
| 25 | `onboarding-beginner-beat-13-pick-habits:sleep-consistently` (source: `beatsSource.ts:10637`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Sleep more consistently” goal. | — |
| 26 | `onboarding-beginner-beat-13-pick-habits:sleep-deeply` (source: `beatsSource.ts:11136`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Sleep more deeply” goal. | — |
| 27 | `onboarding-beginner-beat-13-pick-habits:walk-more` (source: `beatsSource.ts:11630`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Walk more” goal. | — |
| 28 | `onboarding-beginner-beat-13-pick-habits:exercise-consistently` (source: `beatsSource.ts:12124`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Exercise consistently” goal. | — |
| 29 | `onboarding-beginner-beat-13-pick-habits:mobility` (source: `beatsSource.ts:12624`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Improve mobility” goal. | — |
| 30 | `onboarding-beginner-beat-13-pick-habits:eat-intentionally` (source: `beatsSource.ts:13118`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Eat more intentionally” goal. | — |
| 31 | `onboarding-beginner-beat-13-pick-habits:reduce-overeating` (source: `beatsSource.ts:13617`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Reduce overeating” goal. | — |
| 32 | `onboarding-beginner-beat-13-pick-habits:plan-food` (source: `beatsSource.ts:14115`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Plan food better” goal. | — |
| 33 | `onboarding-beginner-beat-13-pick-habits:morning-energy` (source: `beatsSource.ts:14609`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Have more morning energy” goal. | — |
| 34 | `onboarding-beginner-beat-13-pick-habits:avoid-crashes` (source: `beatsSource.ts:15104`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Avoid afternoon crashes” goal. | — |
| 35 | `onboarding-beginner-beat-13-pick-habits:stable-energy` (source: `beatsSource.ts:15599`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Keep energy more stable” goal. | — |
| 36 | `onboarding-beginner-beat-13-pick-habits:calmer-day` (source: `beatsSource.ts:16094`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Feel calmer during the day” goal. | — |
| 37 | `onboarding-beginner-beat-13-pick-habits:evening-stress` (source: `beatsSource.ts:16589`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Reduce evening stress” goal. | — |
| 38 | `onboarding-beginner-beat-13-pick-habits:less-overwhelmed` (source: `beatsSource.ts:17083`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Feel less overwhelmed” goal. | — |
| 39 | `onboarding-beginner-beat-13-pick-habits:start-work` (source: `beatsSource.ts:17581`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Start work with less friction” goal. | — |
| 40 | `onboarding-beginner-beat-13-pick-habits:deeper-work` (source: `beatsSource.ts:18076`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Do deeper work” goal. | — |
| 41 | `onboarding-beginner-beat-13-pick-habits:procrastinate-less` (source: `beatsSource.ts:18570`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Procrastinate less” goal. | — |
| 42 | `onboarding-beginner-beat-13-pick-habits:smoking` (source: `beatsSource.ts:19068`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Smoking” goal. | ODDITY — goal wording is a behavior/substance, unlike the improvement-oriented labels; confirm intended user-facing framing. |
| 43 | `onboarding-beginner-beat-13-pick-habits:weed` (source: `beatsSource.ts:19562`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Weed” goal. | ODDITY — goal wording is terse/ambiguous; confirm whether it means reduce, quit, or manage use. |
| 44 | `onboarding-beginner-beat-13-pick-habits:alcohol` (source: `beatsSource.ts:20056`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Alcohol” goal. | ODDITY — goal wording is terse/ambiguous; confirm whether it means reduce, quit, or manage use. |
| 45 | `onboarding-beginner-beat-13-pick-habits:porn` (source: `beatsSource.ts:20550`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Porn” goal. | ODDITY — goal wording is terse/ambiguous and sensitive; confirm framing and appropriateness. |
| 46 | `onboarding-beginner-beat-13-pick-habits:phone-use` (source: `beatsSource.ts:21044`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Phone use” goal. | ODDITY — goal wording is behavior-only rather than directional; confirm intended framing. |
| 47 | `onboarding-beginner-beat-13-pick-habits:late-snacking` (source: `beatsSource.ts:21538`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Late-night snacking” goal. | ODDITY — goal wording is behavior-only rather than directional; confirm intended framing. |
| 48 | `onboarding-beginner-beat-13-pick-habits:caffeine` (source: `beatsSource.ts:22033`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Caffeine” goal. | ODDITY — goal wording is terse/ambiguous; confirm whether it means reduce or time intake. |
| 49 | `onboarding-beginner-beat-13-pick-habits:stay-on-tasks` (source: `beatsSource.ts:22527`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Stay on top of tasks” goal. | — |
| 50 | `onboarding-beginner-beat-13-pick-habits:tidy-spaces` (source: `beatsSource.ts:23021`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Keep spaces tidy” goal. | — |
| 51 | `onboarding-beginner-beat-13-pick-habits:life-admin` (source: `beatsSource.ts:23515`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Offers habits for the “Handle life admin better” goal. | — |
| 52 | `onboarding-beginner-beat-13-pick-habits:custom` (source: `beatsSource.ts:24008`) | VARIATION of `onboarding-beginner-beat-13-pick-habits` | Captures a user-written habit instead of goal-specific suggested habits. | ODDITY — switches from `habit-picker` to `custom-entry`, so it may be a distinct interaction rather than a simple variation. |
| 53 | `onboarding-beginner-beat-14-schedule-habits` (source: `beatsSource.ts:24339`) | BASE BEAT | Assigns days to each beginner-selected habit. | — |
| 54 | `onboarding-advanced-beat-15-capture-existing-habits` (source: `beatsSource.ts:24765`) | BASE BEAT | Captures an advanced user’s existing habits by speech or text. | — |
| 55 | `onboarding-advanced-beat-16-schedule-existing-habits` (source: `beatsSource.ts:25199`) | BASE BEAT | Sets frequency/days for advanced users’ existing habits. | — |
| 56 | `onboarding-beat-17-plan-review` (source: `beatsSource.ts:25624`) | BASE BEAT | Shows the proposed plan for approval or editing. | — |
| 57 | `onboarding-beat-18-week-projection:empty` (source: `beatsSource.ts:25977`) | VARIATION of `onboarding-beat-18-week-projection` | Shows projection frame 1: blank starting state. | MISSING-BASE — no projection base entry exists. This appears to be an intentional five-frame closing sequence under an abstract parent, not clearly a missing user-visible screen. |
| 58 | `onboarding-beat-18-week-projection:best` (source: `beatsSource.ts:26253`) | VARIATION of `onboarding-beat-18-week-projection` | Shows projection frame 2: full/best-case week. | MISSING-BASE — no projection base entry exists; likely intentional frame-sequence structure. |
| 59 | `onboarding-beat-18-week-projection:likely` (source: `beatsSource.ts:26529`) | VARIATION of `onboarding-beat-18-week-projection` | Shows projection frame 3: 78% likely week. | MISSING-BASE — no projection base entry exists; likely intentional frame-sequence structure. |
| 60 | `onboarding-beat-18-week-projection:some` (source: `beatsSource.ts:26808`) | VARIATION of `onboarding-beat-18-week-projection` | Shows projection frame 4: 36% partial week. | MISSING-BASE — no projection base entry exists; likely intentional frame-sequence structure. |
| 61 | `onboarding-beat-18-week-projection:avoid` (source: `beatsSource.ts:27087`) | VARIATION of `onboarding-beat-18-week-projection` | Shows projection frame 5: unreported-gap close, then enters the app. | MISSING-BASE — no projection base entry exists; likely intentional frame-sequence structure. |

## Count Yair can quote

- **62 source entries total**: **15 literal BASE beats** (entries without `parent`) and **47 VARIATION entries** (entries with `parent`).
- The source is not a literal 62-screen journey: at minimum, the 30 habit variants, 9 goal variants, category-art variant, and 5 projection frames encode conditional/content/frame detail.

## Variation count by family

| family / parent | variations | base entry present? | review reading |
|---|---:|---|---|
| `onboarding-beat-6-profile` | 2 | No | Structural split: greeting + asks; represent an explicit base/group if the parent is meant to be navigable. |
| `onboarding-beginner-beat-11-pick-category` | 1 | Yes | Conditional presentation variant (`female` art). |
| `onboarding-beginner-beat-12-pick-goals` | 9 | No | Category/custom-specific goal screens; likely variant-only model, but parent is structurally absent. |
| `onboarding-beginner-beat-13-pick-habits` | 30 | Yes | Goal/custom-specific habit content variants. |
| `onboarding-beat-18-week-projection` | 5 | No | Intentional-looking ordered closing frames; parent works as a grouping abstraction, not a screen. |

## Cleanup proposal

1. **Separate the model layers:** retain a compact canonical flow (roughly the conceptual onboarding beats) and move category/goal/habit/projection alternatives into explicit variant data rather than treating every alternative as a peer in play order.
2. **Make absent parents intentional in the schema:** either add non-playable grouping/base records for profile, goals, and projection, or replace `parent` with a `family`/`variantOf` convention that does not imply a missing entry.
3. **Define play-order semantics for variants:** document whether `order` is global source ordering, conditional routing order, or projection-frame order; the women-art and 30 habit alternatives otherwise read as serial steps.
4. **Review the opening trilogy:** decide whether `Splash` → `Get started` → `Coach greeting` is all necessary, or whether one structural/intro record can be removed or consolidated.
5. **Normalize goal labels before review:** clarify directional copy for smoking, weed, alcohol, porn, phone use, late-night snacking, and caffeine; several labels name a behavior without stating the desired outcome.
6. **Check custom entries as distinct interactions:** the goals and habits `custom` records change type to `custom-entry`; decide whether they should remain beat variants or become a reusable inline capture path.
