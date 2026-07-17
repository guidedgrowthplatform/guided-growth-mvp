# Onboarding Acceptance Deepening

This is a proposed replacement depth standard for the consolidated onboarding render. A criterion passes only when its stated observation is true; statements that merely restate a beat's purpose are not acceptance criteria.

## Global interpretation

- **No-skip law:** a beat may advance only on the source-declared condition. Refusal, silence, invalid input, incomplete input, or a failed persistence call never counts as completion unless the beat explicitly permits that branch to advance.
- **Locked copy:** every non-empty `script[].words` line is asserted byte-for-byte after runtime slot substitution. Empty script lines are reveal events, not permission for coach speech.
- **Tool boundary:** the harness records every tool call and fails the beat if any tool outside the quoted set is called, if a save tool is called before valid capture, or if `advance_step` precedes a successful save.
- **Persistence boundary:** DB probes assert only the exact `dataOut` keys and destinations quoted from `beatsSource.ts`; no field is inferred or invented here.
- **Variations:** listed variations inherit the base criteria unless a variation-specific criterion below says otherwise.

## 1. Splash — `onboarding-beat-1-splash`

Source contract: `allowedTools: null`, `script: []`, and `dataOut: []` (`src/components/flow-designer/beatsSource.ts:112`, `src/components/flow-designer/beatsSource.ts:118`, `src/components/flow-designer/beatsSource.ts:124`, `src/components/flow-designer/beatsSource.ts:274`).

| Acceptance criterion                                                                                                                                       | Check method |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| On cold start, the splash renders before get-started and contains no input control that accepts tap, text, or voice data.                                  | Harness      |
| No coach audio, transcript line, synthesized speech, or bubble is emitted during the splash because `script` is empty.                                     | Harness      |
| The tool-call log remains empty for the entire beat.                                                                                                       | Harness      |
| A before/after persistence snapshot has no onboarding user-data mutation because `dataOut` is empty.                                                       | DB probe     |
| The beat advances to get-started only after the splash display lifecycle completes; a stray tap or voice event does not create a save or alternate branch. | Harness      |
| If the splash asset fails to load, the flow still reaches get-started and does not strand the user or invent coach copy.                                   | Manual       |

## 2. Get Started — `onboarding-beat-2-get-started`

Source contract: `allowedTools: null`, `script: []`, and `dataOut: []` (`src/components/flow-designer/beatsSource.ts:278`, `src/components/flow-designer/beatsSource.ts:284`, `src/components/flow-designer/beatsSource.ts:290`, `src/components/flow-designer/beatsSource.ts:440`).

| Acceptance criterion                                                                                                                                     | Check method |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The beat remains on get-started indefinitely until the user activates the Get started control; elapsed time, silence, and voice input do not advance it. | Harness      |
| One valid tap advances exactly once to coach-greeting; double-tap does not skip coach-greeting or create duplicate navigation.                           | Harness      |
| No coach audio, bubble, transcript line, or improvised greeting is emitted because `script` is empty.                                                    | Harness      |
| The tool-call log remains empty before and after the tap.                                                                                                | Harness      |
| A before/after persistence snapshot has no user-data mutation because `dataOut` is empty.                                                                | DB probe     |
| A disabled, obscured, or failed tap leaves the user on this beat and exposes a retryable control rather than auto-advancing.                             | Manual       |

## 3. Coach Greeting — `onboarding-beat-3-coach-greeting`

Source contract: `allowedTools: null`, `dataOut: []`, and the locked MP3 line beginning “Hey, I might have startled you…” (`src/components/flow-designer/beatsSource.ts:444`, `src/components/flow-designer/beatsSource.ts:451`, `src/components/flow-designer/beatsSource.ts:457`, `src/components/flow-designer/beatsSource.ts:687`). Edge rules are source-defined at `src/components/flow-designer/beatsSource.ts:494`.

| Acceptance criterion                                                                                                                               | Check method |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The rendered transcript equals the full source `script[0].words` byte-for-byte, and the played asset is the source MP3 rather than live synthesis. | Harness      |
| No lead-in, filler, paraphrase, response to the user, or trailing sentence is spoken before or after the locked line.                              | Harness      |
| The beat does not advance before the greeting clip's end event and advances exactly once after that event.                                         | Harness      |
| User speech, taps, or text during playback are not captured, persisted, or answered and do not interrupt the required transition.                  | Harness      |
| The tool-call log remains empty and a DB diff shows no user-data mutation because `dataOut` is empty.                                              | DB probe     |
| If audio playback fails, the exact greeting remains visible as text and the beat still advances; it must not leave a silent blocked screen.        | Harness      |

## 4. Sign Up — `onboarding-beat-4-sign-up`

Source contract: `allowedTools: null`; `dataOut` is exactly `profile.name` written by `auth sign-up` to `auth account`, plus `session` from `server-hydration` (`src/components/flow-designer/beatsSource.ts:695`, `src/components/flow-designer/beatsSource.ts:702`, `src/components/flow-designer/beatsSource.ts:947`). The beat has no coach script (`src/components/flow-designer/beatsSource.ts:708`) and source edge rules at `src/components/flow-designer/beatsSource.ts:731`.

| Acceptance criterion                                                                                                                        | Check method |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The beat emits no coach audio or invented sign-up instructions because `script` is empty.                                                   | Harness      |
| Starting an auth provider without completing it does not advance the flow.                                                                  | Harness      |
| A successful provider callback advances only after a valid authenticated `session` is available to server hydration.                        | Harness      |
| The auth account contains the provider-derived `profile.name`; the test fails if the beat writes an invented onboarding name field instead. | DB probe     |
| The hydrated session belongs to the same authenticated account whose `profile.name` was captured.                                           | DB probe     |
| Cancelling the provider sheet leaves sign-in options visible, makes no completed-session transition, and permits a new attempt.             | Harness      |
| An auth error displays a retryable failure state, does not advance, and does not leave a partial authenticated session treated as success.  | Harness      |
| No onboarding coach tool is called; authentication is the only write mechanism on this beat.                                                | Harness      |

## 5. Microphone Permission — `onboarding-beat-5-mic-permission`

Source contract: `allowedTools: null`; `dataOut` is exactly `device.micGranted`, persisted to `none (OS permission)`; locked opener: “I'd love to actually talk with you. If you let me use your mic, you can just speak.” (`src/components/flow-designer/beatsSource.ts:965`, `src/components/flow-designer/beatsSource.ts:972`, `src/components/flow-designer/beatsSource.ts:981`, `src/components/flow-designer/beatsSource.ts:1241`). Edge rules are at `src/components/flow-designer/beatsSource.ts:1016`.

| Acceptance criterion                                                                                                                                                                               | Check method |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The coach plays the locked opener byte-for-byte with no pressure, benefit claims, or filler added.                                                                                                 | Harness      |
| Tapping Allow opens the OS permission request; granting it makes `device.micGranted` true in device permission state and advances exactly once.                                                    | Harness      |
| Tapping Not now does not open the OS permission request, leaves mic access ungranted, speaks exactly “That's completely fine, you can just type.” when that edge audio is available, and advances. | Harness      |
| A permanent OS denial does not loop or reopen the permission prompt; the UI falls back to typing and advances.                                                                                     | Harness      |
| Silence alone does not select Allow or Not now and does not advance.                                                                                                                               | Harness      |
| No DB row or onboarding field is written for `device.micGranted`, because the source persistence destination is explicitly `none (OS permission)`.                                                 | DB probe     |
| The tool-call log remains empty on grant, denial, skip, and blocked-OS branches.                                                                                                                   | Harness      |
| The beat never implies that microphone access is mandatory or prevents onboarding after denial.                                                                                                    | Manual       |

## 6A. Profile Greeting — `onboarding-beat-6-profile:greeting`

Source contract: `allowedTools: null`, `dataOut: []`, and locked live line “Awesome {name}, two quick things so I can tailor this to you.” (`src/components/flow-designer/beatsSource.ts:1257`, `src/components/flow-designer/beatsSource.ts:1264`, `src/components/flow-designer/beatsSource.ts:1270`, `src/components/flow-designer/beatsSource.ts:1515`). Edge rules are at `src/components/flow-designer/beatsSource.ts:1307`.

| Acceptance criterion                                                                                                                     | Check method |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| With a hydrated name, the coach says the locked sentence byte-for-byte after replacing only `{name}` with that name.                     | Harness      |
| The live voice contains no literal `{name}`, blank pause, duplicate name, added question, or improvised tail.                            | Harness      |
| The beat advances only after the live line's completion event and advances to profile asks exactly once.                                 | Harness      |
| If the name is missing, the coach uses the source-required name-free warm fallback, does not vocalize an empty slot, and still advances. | Harness      |
| If audio fails, the resolved line is visible as text and the beat advances rather than blocking.                                         | Harness      |
| User input during the line is not captured or persisted, the tool log remains empty, and a DB diff is empty because `dataOut` is empty.  | DB probe     |

## 6B. Profile Asks — `onboarding-beat-6-profile:asks`

Source contract: tools are exactly `submit_profile` and `advance_step`; `dataOut` is exactly `profile.age -> onboarding_states.data.age` and `profile.gender -> onboarding_states.data.gender` (`src/components/flow-designer/beatsSource.ts:1525`, `src/components/flow-designer/beatsSource.ts:1532`, `src/components/flow-designer/beatsSource.ts:1781`, `src/components/flow-designer/beatsSource.ts:1914`). Locked asks are defined at `src/components/flow-designer/beatsSource.ts:1539`; edge rules at `src/components/flow-designer/beatsSource.ts:1580`.

| Acceptance criterion                                                                                                                                                                                   | Check method |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------- | ------- |
| The coach emits only the source asks “How old are you, and how do you identify?” and, when needed, “What's your gender?”, with no unrelated profile questions.                                         | Harness      |
| A valid tap/text/voice answer containing both fields calls `submit_profile` once with `{ age: number, gender: "Male"                                                                                   | "Female"     | "Other" }`, using the canonical enum rather than raw wording. | Harness |
| An age-only answer retains the age, asks only for gender, and does not call `submit_profile` or `advance_step` yet.                                                                                    | Harness      |
| A gender-only or otherwise partial answer leaves the beat gated and asks only for the missing required field.                                                                                          | Harness      |
| Nonsense or nonnumeric age is not stored; the coach gives one light redirect and re-asks plainly.                                                                                                      | Harness      |
| A refusal to provide gender is not converted to `Other`, is not stored, and cannot advance; the coach plainly re-asks and leaves the tap path available.                                               | Harness      |
| On success, DB values at `onboarding_states.data.age` and `.gender` exactly match the submitted canonical values and no category/goal/habit field changes.                                             | DB probe     |
| `advance_step` occurs only after `submit_profile` succeeds; on first tool failure the same payload retries once, and on second failure the entries remain, failure is surfaced, and no advance occurs. | Harness      |
| Silence, off-topic input, and max-turn exhaustion never fabricate either field or bypass the two-field gate.                                                                                           | Harness      |
| Any tool other than `submit_profile` or `advance_step`, or either tool called out of order, fails the beat.                                                                                            | Harness      |

## 7. State Check — `onboarding-beat-7-state-check`

Source contract: tools are exactly `record_checkin` and `advance_step`; `dataOut` is exactly `checkin.state -> onboarding_states.data.stateCheck + daily_checkins (atomic)` (`src/components/flow-designer/beatsSource.ts:1931`, `src/components/flow-designer/beatsSource.ts:1938`, `src/components/flow-designer/beatsSource.ts:2222`, `src/components/flow-designer/beatsSource.ts:2334`). Locked framing and four asks are at `src/components/flow-designer/beatsSource.ts:1944`; edge rules at `src/components/flow-designer/beatsSource.ts:2023`.

| Acceptance criterion                                                                                                                                                  | Check method |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The framing plus “How's your sleep/mood/energy/stress?” lines play in source sequence, verbatim, with no extra dimension or interpretation.                           | Harness      |
| Tap and voice paths both map each dimension only to an integer 1–5 and visibly retain previously completed cards.                                                     | Harness      |
| `record_checkin` is called exactly once only after all four values exist, with `{ sleep, mood, energy, stress, source: "onboarding" }`.                               | Harness      |
| Leaving any card unrated blocks both `record_checkin` and `advance_step`; the coach prompts only for the missing dimension.                                           | Harness      |
| An out-of-range, ambiguous, or nonnumeric voice rating is not coerced or stored and triggers a targeted retry for that dimension.                                     | Harness      |
| The onboarding state-check record and `daily_checkins` record contain the same four scores and onboarding source as one atomic success; neither side may exist alone. | DB probe     |
| `advance_step` fires only after atomic persistence succeeds.                                                                                                          | Harness      |
| On save failure, ratings stay selected, the call retries once, a second failure is surfaced, and neither partial persistence nor advance is accepted.                 | Harness      |
| If the user shares something heavy, the coach pauses setup and responds humanly; it must not silently save guessed ratings or rush to the next card.                  | Manual       |
| No tool outside `record_checkin` and `advance_step` is called.                                                                                                        | Harness      |

## 8. Morning Check-in Setup — `onboarding-beat-8-morning-checkin-setup`

Source contract: tools are exactly `submit_morning_checkin` and `advance_step`; `dataOut` is exactly `checkin.config -> onboarding_states.data.morningCheckin` (`src/components/flow-designer/beatsSource.ts:2376`, `src/components/flow-designer/beatsSource.ts:2383`, `src/components/flow-designer/beatsSource.ts:2677`, `src/components/flow-designer/beatsSource.ts:2788`). Locked narration/recommendation and reveal sequence begin at `src/components/flow-designer/beatsSource.ts:2391`; edge rules at `src/components/flow-designer/beatsSource.ts:2471`.

| Acceptance criterion                                                                                                                                                | Check method |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Every non-empty morning script line is spoken byte-for-byte in sequence; empty script entries reveal controls without generating coach speech.                      | Harness      |
| Time and day controls can be completed by tap, and equivalent voice input resolves to the same canonical config shown in the UI.                                    | Harness      |
| The coach does not read visible time/day options aloud and does not improvise beyond the locked recommendation.                                                     | Harness      |
| `submit_morning_checkin` is not called until every source-required config value is valid; partial time/day input remains on this beat.                              | Harness      |
| Invalid time, unsupported day wording, or ambiguous relative timing is not guessed; the coach asks one short question for the missing/ambiguous value.              | Harness      |
| A refusal or silence leaves the setup unsubmitted and unadvanced; the recommendation may be re-presented, but the system must not silently accept a default.        | Harness      |
| After success, `onboarding_states.data.morningCheckin` exactly matches the submitted `checkin.config`; no reflection or habit config changes.                       | DB probe     |
| `advance_step` follows one successful `submit_morning_checkin`; a first failure retries once, a second is surfaced with selections retained, and no advance occurs. | Harness      |
| Only `submit_morning_checkin` and `advance_step` appear in the tool log.                                                                                            | Harness      |

## 9. Evening Reflection Setup — `onboarding-beat-9-evening-reflection-setup`

Source contract: tools are exactly `submit_reflection_config`, `submit_custom_prompts`, and `advance_step`; `dataOut` is exactly `reflection.config -> reflection_settings.config` and `reflection.customPrompts -> reflection_settings.config.customPrompts`, verbatim, 1–10 prompts, each 1–280 characters (`src/components/flow-designer/beatsSource.ts:2828`, `src/components/flow-designer/beatsSource.ts:2835`, `src/components/flow-designer/beatsSource.ts:3233`, `src/components/flow-designer/beatsSource.ts:3367`). Locked lines/reveals begin at `src/components/flow-designer/beatsSource.ts:2841`; edge rules at `src/components/flow-designer/beatsSource.ts:2954`.

| Acceptance criterion                                                                                                                                                                     | Check method |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Every non-empty reflection script line, including the three default questions and timing recommendation, is emitted byte-for-byte and in source order.                                   | Harness      |
| Empty script entries only reveal reflection controls; the coach does not invent speech for them or read visible choices as a list.                                                       | Harness      |
| Tap and voice paths can select the default questions, free-talk mode, or the supported custom-prompt path and render the same config state.                                              | Harness      |
| `submit_custom_prompts` receives only 1–10 prompts, each 1–280 characters, and preserves every accepted prompt verbatim rather than rewriting it.                                        | Harness      |
| Zero prompts, an eleventh prompt, or a prompt outside 1–280 characters is rejected in place and cannot advance.                                                                          | Harness      |
| `submit_reflection_config` is called only after a valid reflection mode/schedule is present; `submit_custom_prompts` is called only when custom prompts were actually chosen.            | Harness      |
| DB `reflection_settings.config` equals `reflection.config`, and `.customPrompts` is absent/unchanged for non-custom paths or exactly equals submitted verbatim prompts for custom paths. | DB probe     |
| Silence, refusal, or incomplete scheduling does not create a default choice behind the user's back and does not call `advance_step`.                                                     | Harness      |
| Invalid or ambiguous voice input triggers one targeted clarification and retains already valid selections.                                                                               | Harness      |
| Save calls retry once on failure; a second failure is surfaced, input remains available, and `advance_step` is forbidden until all required writes succeed.                              | Harness      |
| No tool outside the three quoted tools is called.                                                                                                                                        | Harness      |

## 10. Experience Fork — `onboarding-beat-10-experience-fork`

Source contract: tools are exactly `submit_path_choice`, `ask_clarification`, and `advance_step`; `dataOut` is exactly `flow.path -> onboarding_states.data.path` (`src/components/flow-designer/beatsSource.ts:3428`, `src/components/flow-designer/beatsSource.ts:3435`, `src/components/flow-designer/beatsSource.ts:3714`, `src/components/flow-designer/beatsSource.ts:3840`). Locked lines/reveal begin at `src/components/flow-designer/beatsSource.ts:3441`; edge rules at `src/components/flow-designer/beatsSource.ts:3493`.

| Acceptance criterion                                                                                                                                 | Check method                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| The coach says “One more question before we set up your habits.” and “Do you already track habits or is this new to you?” byte-for-byte, then stops. | Harness                                                                 |
| The empty third script line reveals the second path card silently; no option list, reassurance tail, or “both are fine” copy is spoken.              | Harness                                                                 |
| Tapping either path and speaking an unambiguous equivalent both map to exactly `beginner` or `advanced`.                                             | Harness                                                                 |
| New/tried-and-dropped-off/wants-guidance resolves to `beginner`; an existing list/system resolves to `advanced`.                                     | Harness                                                                 |
| Ambiguous input calls `ask_clarification` at most as needed and asks the source short contrast; it does not call `submit_path_choice` yet.           | Harness                                                                 |
| Refusal, silence, off-topic input, and max-turn re-ask do not select a path or advance.                                                              | Harness                                                                 |
| `submit_path_choice` is called once with `{ path: "beginner"                                                                                         | "advanced" }`, and DB `onboarding_states.data.path` exactly matches it. | DB probe |
| `advance_step` follows only a successful path save and routes to the matching branch; it never flashes or enters the opposite branch.                | Harness                                                                 |
| On save failure, retry once with the same path; after a second failure surface it, retain the selection, and do not advance.                         | Harness                                                                 |
| No tool outside the quoted three is called, and locked lines are never live-improvised.                                                              | Harness                                                                 |

## 11. Pick Category — `onboarding-beginner-beat-11-pick-category`

Source contract: tools are exactly `submit_category` and `advance_step`; `dataOut` is exactly `onboarding.category -> onboarding_states.data (verify key at app-reconcile)` (`src/components/flow-designer/beatsSource.ts:3856`, `src/components/flow-designer/beatsSource.ts:3863`, `src/components/flow-designer/beatsSource.ts:4171`, `src/components/flow-designer/beatsSource.ts:4349`). Locked lines/reveals begin at `src/components/flow-designer/beatsSource.ts:3869`; edge rules at `src/components/flow-designer/beatsSource.ts:4235`.

Variation `onboarding-beginner-beat-11-pick-category:women` inherits this contract and changes category art only (`src/components/flow-designer/beatsSource.ts:4364`).

| Acceptance criterion                                                                                                                                                                                                               | Check method     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| The coach speaks the two non-empty source lines byte-for-byte; category-card reveal is silent and visible options are not read aloud.                                                                                              | Harness          |
| A category tap and an unambiguous spoken category select the same canonical visible label.                                                                                                                                         | Harness          |
| Exactly one category is submitted; a changed selection replaces the pending choice rather than creating two categories.                                                                                                            | Harness          |
| A custom-category path requires non-empty user-provided category text and does not invent or rewrite a category for the user.                                                                                                      | Harness          |
| Vague input asks one short clarification; silence or an empty card state triggers a neutral display check, not recitation of the category list.                                                                                    | Harness          |
| Refusal or repeated non-selection remains on this beat with the tap path available; it does not submit a default or skip ahead.                                                                                                    | Harness          |
| `submit_category` fires once only after a valid category exists; DB inspection verifies the exact `onboarding.category` value at the source-marked `onboarding_states.data` destination without assuming an unverified nested key. | DB probe         |
| `advance_step` follows successful save only; a failed save retries once, then surfaces failure with the selected card retained and no advance.                                                                                     | Harness          |
| Only `submit_category` and `advance_step` are called.                                                                                                                                                                              | Harness          |
| The women variation changes artwork but not spoken copy, tools, value semantics, persistence contract, edge behavior, or gate.                                                                                                     | Visual + harness |

## 12. Pick Goals — `onboarding-beginner-beat-12-pick-goals:*`

Canonical contract shown by the sleep variation: tools are exactly `submit_goals` and `advance_step`; `dataOut` is exactly `onboarding.goals -> onboarding_states.data (verify key)`, while goal count is derived as `goals.length` and is **not** a separate persisted field (`src/components/flow-designer/beatsSource.ts:4873`, `src/components/flow-designer/beatsSource.ts:4880`, `src/components/flow-designer/beatsSource.ts:5183`, `src/components/flow-designer/beatsSource.ts:5347`). Sleep locked copy/edges begin at `src/components/flow-designer/beatsSource.ts:4888` and `src/components/flow-designer/beatsSource.ts:4918`.

The move, eat, energy, stress, focus, break, organize, and custom variations inherit the contract but use their own source opener and option vocabulary (`src/components/flow-designer/beatsSource.ts:5364`, `src/components/flow-designer/beatsSource.ts:5856`, `src/components/flow-designer/beatsSource.ts:6348`, `src/components/flow-designer/beatsSource.ts:6841`, `src/components/flow-designer/beatsSource.ts:7333`, `src/components/flow-designer/beatsSource.ts:7825`, `src/components/flow-designer/beatsSource.ts:8317`, `src/components/flow-designer/beatsSource.ts:8808`).

| Acceptance criterion                                                                                                                                                           | Check method |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| For the active variation, the coach emits that variation's `script[].words` byte-for-byte and does not borrow copy or labels from another category.                            | Harness      |
| Tap and voice paths map only to canonical labels visible for the active variation; raw synonyms are normalized to an existing label, never persisted as a new invented label.  | Harness      |
| One or two valid goals enable submission; zero goals and three-or-more goals block both save and advance.                                                                      | Harness      |
| When three or more are named, the coach asks “Which two matter most right now?”, retains candidate context, and submits only the user's resolved two.                          | Harness      |
| Vague “in general” input maps only when unambiguous; otherwise the coach asks the variation's one short pin-down question and does not invent a label.                         | Harness      |
| Silence or missing tiles triggers the neutral display check and never causes the coach to read the goal list aloud.                                                            | Harness      |
| Refusal/off-topic/max-turn behavior returns to a one-line goal re-ask and leaves the tap path available; no default goal is selected and no advance occurs.                    | Harness      |
| `submit_goals` is called once with an array of exactly 1–2 canonical goals; DB `onboarding.goals` equals that array at the source-marked `onboarding_states.data` destination. | DB probe     |
| No separate `goalCount` or equivalent field is persisted; downstream count is demonstrably derived from `goals.length`.                                                        | DB probe     |
| `advance_step` follows successful save only; save failure retries once, then surfaces with selected tiles retained and no advance.                                             | Harness      |
| Only `submit_goals` and `advance_step` appear in the tool log.                                                                                                                 | Harness      |

## 13. Pick Habits — `onboarding-beginner-beat-13-pick-habits:*`

Base contract: tools are exactly `add_habit`, `remove_habit`, and `advance_step`; `dataOut` is exactly `onboarding.habits -> onboarding_states.data.habitConfigs` (`src/components/flow-designer/beatsSource.ts:9132`, `src/components/flow-designer/beatsSource.ts:9139`, `src/components/flow-designer/beatsSource.ts:9459`, `src/components/flow-designer/beatsSource.ts:9628`). Base locked copy/edges begin at `src/components/flow-designer/beatsSource.ts:9146` and `src/components/flow-designer/beatsSource.ts:9187`.

Named goal variations inherit the same contract and supply their own locked opener/options (`src/components/flow-designer/beatsSource.ts:9645` through `src/components/flow-designer/beatsSource.ts:23515`). The custom variation asks “What habit do you want to build?” and persists to the same habit config (`src/components/flow-designer/beatsSource.ts:24008`, `src/components/flow-designer/beatsSource.ts:24022`, `src/components/flow-designer/beatsSource.ts:24327`). **Source conflict to resolve:** its top-level `allowedTools` is `null` at `src/components/flow-designer/beatsSource.ts:24014`, while its Bible tool list says `add_habit` and `advance_step` at `src/components/flow-designer/beatsSource.ts:24224`; acceptance must fail until the render exposes one unambiguous allowed set.

| Acceptance criterion                                                                                                                                                                                                | Check method |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The active variation's opener is spoken byte-for-byte; copy and suggested habits from any other goal variation never appear.                                                                                        | Harness      |
| A suggested-habit tap and an unambiguous spoken equivalent add the same canonical habit card.                                                                                                                       | Harness      |
| Each `add_habit` produces exactly one config entry; replay, double-tap, or repeated synonym does not duplicate the same habit.                                                                                      | DB probe     |
| Removing a selected habit calls `remove_habit` and removes only that habit while retaining all others.                                                                                                              | Harness      |
| The configured per-goal habit cap is enforced: attempts above the cap do not write or advance and ask the user to resolve the set.                                                                                  | Harness      |
| Zero selected habits blocks `advance_step`; refusal, silence, and max-turn behavior keep the beat open without manufacturing a habit.                                                                               | Harness      |
| Vague or unsupported voice input is clarified against visible choices; the coach does not invent a canonical habit or read the full list aloud.                                                                     | Harness      |
| DB `onboarding_states.data.habitConfigs` exactly reflects additions/removals and contains no schedule days silently added on this selection beat.                                                                   | DB probe     |
| Tool failure retries once with UI selection retained; a second failure is surfaced and cannot advance.                                                                                                              | Harness      |
| Named variations call only `add_habit`, `remove_habit`, and `advance_step`; the custom variation's contract check fails while top-level `allowedTools: null` disagrees with Bible tools `add_habit`/`advance_step`. | Harness      |
| After that source conflict is reconciled, the custom variation rejects empty/whitespace input; accepted text is added as the user-supplied habit and the coach does not rename it.                                  | Harness      |

## 14. Schedule Habits — `onboarding-beginner-beat-14-schedule-habits`

Source contract: tools are exactly `add_habit`, `update_habit`, and `advance_step`; `dataOut` is exactly `onboarding.habits -> onboarding_states.data.habitConfigs`, adding days per habit (`src/components/flow-designer/beatsSource.ts:24339`, `src/components/flow-designer/beatsSource.ts:24346`, `src/components/flow-designer/beatsSource.ts:24599`, `src/components/flow-designer/beatsSource.ts:24724`). Locked lines/reveal begin at `src/components/flow-designer/beatsSource.ts:24352`; edge rules at `src/components/flow-designer/beatsSource.ts:24407`.

| Acceptance criterion                                                                                                                     | Check method |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --- | --- | --- | --- | --- | ------- |
| The two non-empty scheduling lines play byte-for-byte and the empty line reveals scheduling controls without extra coach speech.         | Harness      |
| Tap and voice day selections resolve to numeric day arrays using only `0                                                                 | 1            | 2   | 3   | 4   | 5   | 6`. | Harness |
| `update_habit` identifies the intended habit by name and changes its days while preserving omitted reminder/time/schedule fields.        | DB probe     |
| `add_habit` is used only when the user explicitly adds a habit on this beat; scheduling an existing card never duplicates it.            | Harness      |
| Every selected habit must have at least one valid day before `advance_step`; a partial set asks only for unscheduled habits.             | Harness      |
| Invalid day names, contradictory schedules, silence, or refusal do not create default days and do not advance.                           | Harness      |
| DB `onboarding_states.data.habitConfigs` contains the chosen days on the correct habits and preserves names and unrelated config fields. | DB probe     |
| A failed add/update retries once; after a second failure days stay selected in UI, failure is surfaced, and no advance occurs.           | Harness      |
| Only `add_habit`, `update_habit`, and `advance_step` are called; `remove_habit` is not allowed on this beat.                             | Harness      |

## 15. Capture Existing Habits — `onboarding-advanced-beat-15-capture-existing-habits`

Source contract: tools are exactly `submit_brain_dump` and `advance_step`; `dataOut` is exactly `advanced.brainDump -> onboarding_states.data.brainDumpText + onboarding_states.brain_dump_raw` (`src/components/flow-designer/beatsSource.ts:24765`, `src/components/flow-designer/beatsSource.ts:24772`, `src/components/flow-designer/beatsSource.ts:25061`, `src/components/flow-designer/beatsSource.ts:25184`). Locked prompt/confirmation lines begin at `src/components/flow-designer/beatsSource.ts:24778`; edge rules at `src/components/flow-designer/beatsSource.ts:24832`.

| Acceptance criterion                                                                                                                                        | Check method |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The coach speaks the initial list request and later review line byte-for-byte; the silent reveal between them emits no invented narration.                  | Harness      |
| Tap/text and voice dictation both capture the user's complete raw list before submission; silence or an empty list does not call `submit_brain_dump`.       | Harness      |
| `submit_brain_dump` is called once with the captured list, and the resulting cards preserve each stated habit rather than adding suggested habits.          | Harness      |
| The parsed review marks each card build or break; the coach asks for confirmation and does not advance merely because parsing finished.                     | Harness      |
| If one card's wording or build/break mark is challenged, only that card changes; all unchallenged cards remain byte-for-byte stable.                        | Harness      |
| User approval is required after review; refusal, ambiguity, silence, or an unresolved correction keeps the beat gated.                                      | Harness      |
| `onboarding_states.data.brainDumpText` and `onboarding_states.brain_dump_raw` are both written from this capture and correspond to the same submitted dump. | DB probe     |
| A failed submission retries once; after a second failure the raw input remains visible, failure is surfaced, and no review/advance is treated as complete.  | Harness      |
| `advance_step` occurs only after the reviewed set is confirmed.                                                                                             | Harness      |
| Only `submit_brain_dump` and `advance_step` are called; habit add/update tools are forbidden here.                                                          | Harness      |

## 16. Schedule Existing Habits — `onboarding-advanced-beat-16-schedule-existing-habits`

Source contract: tools are exactly `add_habit`, `update_habit`, and `advance_step`; `dataOut` is exactly `onboarding.habits -> onboarding_states.data.habitConfigs` (`src/components/flow-designer/beatsSource.ts:25199`, `src/components/flow-designer/beatsSource.ts:25206`, `src/components/flow-designer/beatsSource.ts:25482`, `src/components/flow-designer/beatsSource.ts:25610`). Locked lines/reveals begin at `src/components/flow-designer/beatsSource.ts:25212`; edge rules at `src/components/flow-designer/beatsSource.ts:25279`.

| Acceptance criterion                                                                                                                                                                                 | Check method |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Every non-empty scheduling and completion line is spoken byte-for-byte; empty reveal lines add no improvised speech.                                                                                 | Harness      |
| Tap and voice day selections resolve to numeric `0–6` arrays on the intended existing habit.                                                                                                         | Harness      |
| `update_habit` changes only supplied fields and preserves the captured habit name, build/break identity, and omitted reminder/time/schedule fields.                                                  | DB probe     |
| `add_habit` is called only for an explicitly missing habit; ordinary scheduling never duplicates an existing card.                                                                                   | Harness      |
| Every captured habit needs days before advance; partial answers retain completed habits and ask only for missing schedules.                                                                          | Harness      |
| Reminder stays off unless the user explicitly requests it for a named habit; a request affects only that habit.                                                                                      | DB probe     |
| Invalid/ambiguous days, silence, or refusal do not create defaults and cannot advance.                                                                                                               | Harness      |
| DB `onboarding_states.data.habitConfigs` exactly reflects the reviewed set plus selected schedules, with no unrelated habit removed or rewritten.                                                    | DB probe     |
| Save failure retries once; a second failure is surfaced with day selections retained, and completion copy/advance cannot be treated as successful.                                                   | Harness      |
| Only `add_habit`, `update_habit`, and `advance_step` are called; despite the `dataOut.writtenBy` note mentioning `remove_habit`, that tool is not in this beat's allowed set and must not be called. | Harness      |

## 17. Plan Review — `onboarding-beat-17-plan-review`

Source contract: the Bible tool list and `plan-tools-only` rule permit only `confirm_plan` (`src/components/flow-designer/beatsSource.ts:25845`), but the top-level `allowedTools` string also names `update_habit` (`src/components/flow-designer/beatsSource.ts:25631`). `dataOut` is exactly `plan.confirmed -> onboarding_states.status + completed_at + current_step (atomic completion)` (`src/components/flow-designer/beatsSource.ts:25624`, `src/components/flow-designer/beatsSource.ts:25962`). Locked review line is at `src/components/flow-designer/beatsSource.ts:25637`; edge rules at `src/components/flow-designer/beatsSource.ts:25666`. **Source conflict to resolve:** acceptance treats the authoritative Bible rule as the intended behavior but requires the top-level field to be reconciled.

| Acceptance criterion                                                                                                                                                                   | Check method |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| The coach says the plan-review line byte-for-byte and the rendered plan shows the actual saved check-in, reflection, and habits rather than placeholders.                              | Harness      |
| The beat is read-only: no edit, habit, profile, check-in, or reflection tool is called from this screen.                                                                               | Harness      |
| Static contract validation fails while top-level `allowedTools` includes `update_habit` but the Bible says only `confirm_plan`; green requires both declarations to name the same set. | Harness      |
| A Ready to start tap and unambiguous spoken approval both call `confirm_plan` exactly once.                                                                                            | Harness      |
| Silence, refusal, ambiguity, or a request to change something does not call `confirm_plan`, does not mark onboarding complete, and does not enter the app.                             | Harness      |
| `confirm_plan` atomically updates `onboarding_states.status`, `completed_at`, and `current_step`; a probe fails if only a subset changes.                                              | DB probe     |
| App entry occurs only after atomic confirmation succeeds; navigation beginning before the success response fails the gate.                                                             | Harness      |
| A first confirmation failure retries once; a second is surfaced and leaves the user on plan review without completion state.                                                           | Harness      |
| Spoken approval without a tap calls `confirm_plan`, enters the app after success, and records the source-required no-tap completion instrumentation.                                   | Harness      |
| The tool log contains no call other than `confirm_plan`; no `advance_step` is invented for this beat.                                                                                  | Harness      |

## 18. Week Projection — `onboarding-beat-18-week-projection:*`

All five projection entries have `allowedTools: null` and `dataOut: []`: empty (`src/components/flow-designer/beatsSource.ts:25977`, `src/components/flow-designer/beatsSource.ts:25984`, `src/components/flow-designer/beatsSource.ts:26246`), best (`src/components/flow-designer/beatsSource.ts:26253`), likely (`src/components/flow-designer/beatsSource.ts:26529`), some (`src/components/flow-designer/beatsSource.ts:26808`), and avoid (`src/components/flow-designer/beatsSource.ts:27087`, `src/components/flow-designer/beatsSource.ts:27094`, `src/components/flow-designer/beatsSource.ts:27359`). Their locked lines begin at `src/components/flow-designer/beatsSource.ts:25992`, `src/components/flow-designer/beatsSource.ts:26268`, `src/components/flow-designer/beatsSource.ts:26544`, `src/components/flow-designer/beatsSource.ts:26823`, and `src/components/flow-designer/beatsSource.ts:27102`.

| Acceptance criterion                                                                                                                                            | Check method     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| The five projection states render in the source order empty → best → likely → some → avoid, with no state skipped or repeated.                                  | Harness          |
| Each state's coach line equals that state's `script[0].words` byte-for-byte; no motivational tail, advice, question, or paraphrase is added.                    | Harness          |
| The visual shown for each state matches its semantic state and changes only when that state's narration/reveal lifecycle permits.                               | Visual + harness |
| User taps, voice, text, refusal, or silence during projection do not call a tool, modify a plan, or create a new onboarding answer.                             | Harness          |
| The tool-call log remains empty across all five entries.                                                                                                        | Harness          |
| A before/after DB snapshot has no user-data mutation because every projection `dataOut` is empty.                                                               | DB probe         |
| Audio failure shows the exact line as text and continues the projection rather than stranding the user or skipping all remaining states.                        | Harness          |
| The final avoid state exits only through the product's declared post-onboarding transition; it must not re-run `confirm_plan` or mark completion a second time. | Harness          |

## Attack checklist for reviewers

A review is red if any answer is “yes”:

1. Does a criterion merely say the beat “works,” “feels right,” or achieves its purpose without naming an observable pass/fail event?
2. Can the criterion pass without checking exact locked copy, explicit silence on reveal lines, or prohibited improvisation?
3. Does any persistence assertion name a field or destination not present in that beat's quoted `dataOut`?
4. Does any criterion permit advance on refusal, silence, invalid/partial input, failed save, or before the required tool succeeds?
5. Is either the tap path or voice path missing where the beat supports both?
6. Are tool retry, retained input, surfaced second failure, and “do not advance” all absent on a saving beat?
7. Does the tool boundary fail to assert both allowed tools and forbidden outside tools?
8. Does a variation inherit criteria even though its copy, allowed tools, cap, vocabulary, or branch genuinely differs?
9. Is there no negative assertion for reading visible options aloud, adding filler to locked copy, or silently choosing defaults?
10. Could a tester execute the stated check method and still be unable to return a binary pass/fail result?

## Author attack result

- **Round 1 — red:** structural beats lacked explicit negative persistence checks; saving beats did not consistently require retained input plus no advance after a second failure; variation exceptions were underspecified.
- **Round 2 — green:** every section now quotes source tools/data, asserts locked or intentionally silent copy, names the positive gate and no-skip negatives, covers failure/invalid/refusal/silence behavior, and states forbidden tools or writes. Remaining `verify key` wording is preserved exactly from source rather than resolved by invention.
