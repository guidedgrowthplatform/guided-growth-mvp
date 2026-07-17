18 official beats appear in the onboarding render, in beat-id order: `1` through `18`.
The render presents five official beats with colon-suffix variations; together those groups contain 47 variation entries.
This table follows the render’s grouping: one lane-dash official id per row, with its colon-suffix entries directly beneath it.

# Beat Audit Table

| # | official id | purpose | # variations | voice engine | tools |
|---:|---|---|---:|---|---|
| 1 | `onboarding-beat-1-splash` | Shows the branded opening splash. | 0 | Silent | — |
| 2 | `onboarding-beat-2-get-started` | Presents the entry point to begin onboarding. | 0 | Silent | — |
| 3 | `onboarding-beat-3-coach-greeting` | Introduces the coach and the onboarding conversation. | 0 | MP3 | — |
| 4 | `onboarding-beat-4-sign-up` | Collects account sign-up details. | 0 | Silent | — |
| 5 | `onboarding-beat-5-mic-permission` | Requests optional microphone access. | 0 | MP3 | — |
| 6 | `onboarding-beat-6-profile` | Welcomes the user, then captures profile details. | 2 | Cartesia / MP3 | `submit_profile`, `advance_step` |
| 6.1 | `:greeting` | Coach greeting with the user’s name. | — | Cartesia | — |
| 6.2 | `:asks` | Age and gender questions. | — | MP3 | `submit_profile`, `advance_step` |
| 7 | `onboarding-beat-7-state-check` | Captures the user’s current state. | 0 | MP3 | `record_checkin`, `advance_step` |
| 8 | `onboarding-beat-8-morning-checkin-setup` | Configures the morning check-in. | 0 | MP3 | `submit_morning_checkin`, `advance_step` |
| 9 | `onboarding-beat-9-evening-reflection-setup` | Configures the evening reflection. | 0 | MP3 | `submit_reflection_config`, `submit_custom_prompts`, `advance_step` |
| 10 | `onboarding-beat-10-experience-fork` | Selects the beginner or advanced onboarding lane. | 0 | MP3 | `submit_path_choice`, `ask_clarification`, `advance_step` |
| 11 | `onboarding-beginner-beat-11-pick-category` | Selects the beginner user’s focus category. | 1 | MP3 | `submit_category`, `advance_step` |
| 11.1 | `:women` | Women’s category artwork. | — | MP3 | `submit_category`, `advance_step` |
| 12 | `onboarding-beginner-beat-12-pick-goals` | Selects goals within the chosen category. | 9 | MP3 | `submit_goals`, `advance_step` |
| 12.1 | `:sleep` | Sleep-better goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.2 | `:move` | Move-more goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.3 | `:eat` | Eat-better goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.4 | `:energy` | More-energy goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.5 | `:stress` | Reduce-stress goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.6 | `:focus` | Improve-focus goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.7 | `:break` | Break-bad-habits goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.8 | `:organize` | Get-organized goal choices. | — | MP3 | `submit_goals`, `advance_step` |
| 12.9 | `:custom` | User-written goal entry. | — | MP3 | — |
| 13 | `onboarding-beginner-beat-13-pick-habits` | Selects habits for the chosen goals. | 30 | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.1 | `:fall-asleep-earlier` | Habits for falling asleep earlier. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.2 | `:wake-earlier` | Habits for waking earlier. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.3 | `:sleep-consistently` | Habits for more consistent sleep. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.4 | `:sleep-deeply` | Habits for deeper sleep. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.5 | `:walk-more` | Habits for walking more. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.6 | `:exercise-consistently` | Habits for consistent exercise. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.7 | `:mobility` | Habits for improving mobility. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.8 | `:eat-intentionally` | Habits for eating more intentionally. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.9 | `:reduce-overeating` | Habits for reducing overeating. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.10 | `:plan-food` | Habits for planning food better. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.11 | `:morning-energy` | Habits for more morning energy. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.12 | `:avoid-crashes` | Habits for avoiding afternoon crashes. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.13 | `:stable-energy` | Habits for steadier energy. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.14 | `:calmer-day` | Habits for a calmer day. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.15 | `:evening-stress` | Habits for reducing evening stress. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.16 | `:less-overwhelmed` | Habits for feeling less overwhelmed. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.17 | `:start-work` | Habits for starting work with less friction. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.18 | `:deeper-work` | Habits for deeper work. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.19 | `:procrastinate-less` | Habits for procrastinating less. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.20 | `:smoking` | Habits associated with smoking. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.21 | `:weed` | Habits associated with weed. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.22 | `:alcohol` | Habits associated with alcohol. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.23 | `:porn` | Habits associated with porn. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.24 | `:phone-use` | Habits associated with phone use. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.25 | `:late-snacking` | Habits for late-night snacking. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.26 | `:caffeine` | Habits associated with caffeine. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.27 | `:stay-on-tasks` | Habits for staying on top of tasks. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.28 | `:tidy-spaces` | Habits for keeping spaces tidy. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.29 | `:life-admin` | Habits for handling life admin better. | — | MP3 | `add_habit`, `remove_habit`, `advance_step` |
| 13.30 | `:custom` | User-written habit entry. | — | MP3 | — |
| 14 | `onboarding-beginner-beat-14-schedule-habits` | Schedules the beginner-selected habits. | 0 | MP3 | `add_habit`, `update_habit`, `advance_step` |
| 15 | `onboarding-advanced-beat-15-capture-existing-habits` | Captures an advanced user’s existing habits. | 0 | MP3 | `submit_brain_dump`, `advance_step` |
| 16 | `onboarding-advanced-beat-16-schedule-existing-habits` | Sets frequency for existing advanced-user habits. | 0 | MP3 | `add_habit`, `update_habit`, `advance_step` |
| 17 | `onboarding-beat-17-plan-review` | Reviews and confirms the proposed plan. | 0 | MP3 | `update_habit`, `confirm_plan` |
| 18 | `onboarding-beat-18-week-projection` | Shows the week-projection sequence before entering the app. | 5 | MP3 | — |
| 18.1 | `:empty` | Blank starting week. | — | MP3 | — |
| 18.2 | `:best` | Full best-case week. | — | MP3 | — |
| 18.3 | `:likely` | 78% likely week. | — | MP3 | — |
| 18.4 | `:some` | 36% partial week. | — | MP3 | — |
| 18.5 | `:avoid` | Unreported-gap close. | — | MP3 | — |

## Source-matches-render proposal

**Proposal — no changes made.** Reshape `src/components/flow-designer/beatsSource.ts` so it exports an ordered collection of 18 official beat entries keyed by the lane-dash ids above. Put each colon-suffix entry in that official entry’s `variations` array, retaining its suffix, render fields, and order. Derive the flat playback list only where the renderer needs it, while `FlowDesigner` reads the nested shape for its groups. **Estimated effort: 0.5–1 day**, including TypeScript type updates and focused render/playback regression checks.

---

## Decision record: the state / habit / reflection split (2026-07-17, third call)

**RULED (both agreed on the call):** the morning flow is THREE distinct parts, not one:
1. **State check**: sleep / mood / energy / stress (the morning state).
2. **Habit check**: marking habits done/missed. Currently mixed into the morning check-in; it MUST separate.
3. **Reflection**: the evening flow.

**What this changes:**
- The earlier "state-check writes daily_checkins atomically" ruling is superseded AS WRITTEN; the intent
  stands (onboarding writes must match how the daily flow will always work, no onboarding-special shape),
  but the exact wiring follows the three-part model.
- The state-check acceptance rows that assert the dual write are tagged PENDING-BACKEND-WIRING in the
  render until the wiring lands.

**OPEN (who closes it):**
- The wiring proposal for the three-part model: authored on the backend side, posted on the ai-bus for
  review, approved before any build (backend changes need review per Yair).
- Items 2 (atomic reflection settings via migration 051's real columns) and 3 (plan-confirm persists
  status=completed + completed_at) are UNCHANGED by the split and are building now.
