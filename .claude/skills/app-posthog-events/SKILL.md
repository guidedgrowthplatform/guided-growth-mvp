---
name: app-posthog-events
description: Use when wiring PostHog analytics, picking the right capture event (view_signup_screen / complete_signup / start_checkin / complete_checkin / start_voice_session / complete_voice_session / create_habit / complete_habit / llm_call / mental_health_safety_triggered / voice_cap_reached etc), defining event properties, naming new events (present-tense per PostHog v5), or understanding why cartesia_latency_ms replaced elevenlabs_latency_ms
user-invocable: false
---

# PostHog Events

Source: Google Sheet **Guided Growth OS App Master** · tab `PostHog Events` · gid `211484324` · maintained by Said (transitioning) → Yonas.

Product analytics taxonomy from **PostHog Analytics Plan v5 (April 2026)**, with v2 plan updates applied:
1. `cartesia_latency_ms` replaces `elevenlabs_latency_ms` in `complete_voice_session` (Cartesia stack change).
2. `checkin_type` uses `evening` (matches `ECHECK-XX`, not the doc's "night").

Three events at the bottom (`llm_call`, `mental_health_safety_triggered`, `voice_cap_reached`) are **NEW in v6.0**.

## When to use
- Wiring a new feature — pick from this list before inventing a new event.
- Confirming the canonical event name + properties (present-tense verbs).
- Understanding which events fire on which screens.
- Checking event priority (P0 / P1 / P2 / P3).

## Distinct from `session_log`

PostHog = **product analytics**. `session_log` = **LLM state delta**. Some user actions fire BOTH (e.g. user adds a habit → PostHog `create_habit` for analytics + `session_log` `habit_added` for LLM context). Intentionally different naming. See `app-session-events`.

## Events by section

### 3.1 Auth (P0)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `view_signup_screen` | User lands on signup screen | `referrer`, `utm_source`, `utm_medium`, `utm_campaign` | WELCOME, AUTH-SIGNUP |
| `start_signup` | User taps a signup method | `method` (apple \| google \| email) | WELCOME, AUTH-SIGNUP |
| `complete_signup` | Account successfully created | `method`, `time_to_complete_seconds` | AUTH-SIGNUP |
| `signup_error` | Signup fails | `method`, `error_type`, `error_message` | AUTH-SIGNUP |
| `view_login_screen` | User lands on login screen | _(none)_ | AUTH-LOGIN |
| `complete_login` | User logs in successfully | `method`, `is_returning_user` | AUTH-LOGIN |
| `login_error` | Login fails | `method`, `error_type` | AUTH-LOGIN |
| `tap_forgot_password` | User taps forgot password | _(none)_ | AUTH-LOGIN |
| `complete_password_reset` | Password reset completed | _(none)_ | AUTH-LOGIN |

### 3.2 Onboarding (P0)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `start_onboarding` | User enters onboarding after signup | _(none)_ | POST-AUTH-SIGNUP [DEPRECATED] → ONBOARD-01 |
| `complete_onboarding_step` | User completes any onboarding step | `step_number` (1-7), `step_name`, `onboarding_path` (beginner\|advanced), `input_method` (voice\|manual), `time_on_step_seconds` | ONBOARD-01..09 |
| `select_onboarding_path` | User picks beginner or advanced | `path` (beginner \| advanced) | ONBOARD-FORK |
| `select_improvement_areas` | Beginner: picks areas to improve | `areas` (list), `area_count` | ONBOARD-BEGINNER-01 |
| `select_specific_goals` | Beginner: narrows down goals | `category`, `goals` (list) | ONBOARD-BEGINNER-02 |
| `submit_voice_goals` | Advanced: submits voice input | `transcript_length_chars`, `duration_seconds` | ONBOARD-ADVANCED-01 (Phase 2+) |
| `view_ai_organized_plan` | Advanced: sees AI-generated habits | `habits_generated_count` | ONBOARD-ADVANCED-02 (Phase 2+) |
| `tap_regenerate_plan` | Advanced: taps Regenerate from scratch | `regeneration_count` | ONBOARD-ADVANCED-02 (Phase 2+) |
| `configure_habit_onboarding` | User configures a habit during onboarding | `habit_name`, `category`, `has_reminder`, `frequency_days`, `input_method` | ONBOARD-BEGINNER-04 |
| `configure_journal_onboarding` | User sets up journaling | `journal_type`, `prompt_count`, `input_method` | ONBOARD-BEGINNER-07 |
| `view_starting_plan` | User sees the plan summary | `total_habits`, `has_journal`, `onboarding_path` | ONBOARD-BEGINNER-10 |
| `complete_onboarding` | User taps Start Plan | `onboarding_path`, `total_habits`, `has_journal`, `total_time_seconds`, `steps_completed` | ONBOARD-BEGINNER-10 |
| `skip_onboarding_step` | User skips a step | `step_number`, `step_name` | ONBOARD-01..09 |
| `drop_off_onboarding` | User leaves during onboarding (server-side via cron) | `last_step_number`, `last_step_name`, `onboarding_path` | ONBOARD-01..09 (server-side) |
| `grant_notification_permission` | User grants/denies push access | `granted` (boolean) | ONBOARD-BEGINNER-09 (or wherever push is requested) |
| `grant_mic_permission` | User grants/denies mic access | `granted` (boolean) | MIC-PERMISSION |

### 4.1 Home & Nav (P0)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `open_app` | App opens / tab focused | `is_first_open_today`, `days_since_last_open`, `session_number` | (global — app launch) |
| `view_home` | Home screen rendered | `habits_due_today`, `habits_completed_today`, `has_pending_checkin` | HOME-FIRST, HOME-MORNING, HOME-EVENING, HOME-RETURN |
| `tap_nav_item` | User taps bottom navigation | `destination` (home \| progress \| voice \| insights \| profile) | (global — bottom nav) |

### 4.2 Check-in (P0)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `start_checkin` | User opens check-in | `checkin_type` (**morning** \| **evening** \| **ad_hoc**), `input_method`, `trigger` (home_card \| reminder \| nav) | MCHECK-01, ECHECK-01 |
| `complete_checkin` | User submits check-in | `checkin_type`, `input_method`, `sleep_quality` (1-5), `mood` (1-5), `energy_level` (1-5), `stress_level` (1-5), `duration_seconds`, `has_journal_entry` | MCHECK-01 (M), ECHECK-06 (E) |
| `abandon_checkin` | User starts but doesn't finish | `checkin_type`, `input_method`, `last_field_completed`, `time_spent_seconds` | MCHECK-01, ECHECK-01..06 |

### 4.3 Voice (P1)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `start_voice_session` | User taps mic button anywhere | `context` (checkin \| journal \| habit_create \| habit_edit \| feedback \| onboarding \| conversation), `screen` | CHAT, all LLM-active screens |
| `complete_voice_session` | Voice transcription completes | `context`, `duration_seconds`, `transcript_length_chars`, `resulted_in_action`, **`cartesia_latency_ms`** | CHAT, all LLM-active screens |
| `cancel_voice_session` | User cancels voice recording | `context`, `duration_seconds`, `reason` (user_cancel \| error \| timeout) | CHAT, all LLM-active screens |
| `voice_ai_response` | AI responds to voice input | `context`, `response_type`, `habits_suggested_count` | CHAT, ONBOARD-*, MCHECK-*, ECHECK-* |
| `accept_voice_suggestion` | User accepts AI suggestion | `context`, `suggestion_type`, `suggestion_count_accepted`, `suggestion_count_total` | CHAT, HABIT-CREATE-FORK, ONBOARD-* |
| `reject_voice_suggestion` | User rejects/edits suggestion | `context`, `suggestion_type`, `action` (edit \| reject \| regenerate) | CHAT, HABIT-CREATE-FORK, ONBOARD-* |

### 4.4 Habit (P1)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `create_habit` | New habit created | `habit_name`, `category`, `subcategory`, `frequency_days`, `has_reminder`, `reminder_time`, `input_method`, `source` (onboarding \| home \| voice_conversation), `is_suggested` | ONBOARD-BEGINNER-03, HABIT-CREATE-FORK, CHAT |
| `complete_habit` | User marks habit as done | `habit_name`, `category`, `current_streak`, `is_on_time`, `day_of_week`, `time_of_day` | HOME-MORNING, HOME-EVENING, ECHECK-02, ECHECK-03, FOCUS-TIMER |
| `miss_habit` | User marks habit as missed (streak breaks) | `habit_name`, `current_streak` | HOME-MORNING, HOME-EVENING, HABIT-LIST |
| `skip_habit` | User skips a habit | `habit_name`, `category`, `current_streak` | HOME-MORNING, HOME-EVENING, ECHECK-02, ECHECK-03 |
| `snooze_habit` | User snoozes a habit | `habit_name`, `snooze_duration` | HOME-MORNING, HOME-EVENING |
| `edit_habit` | User edits a habit | `habit_name`, `fields_changed` (list), `input_method` | HABIT-EDIT, CHAT |
| `delete_habit` | User deletes a habit | `habit_name`, `category`, `lifetime_days`, `total_completions`, `completion_rate` | HABIT-EDIT, CHAT |
| `view_habit_detail` | User opens habit detail screen | `habit_name`, `category`, `current_streak`, `completion_rate` | HABIT-DETAIL |
| `log_habit_reflection` | User logs reflection on habit | `habit_name`, `input_method`, `reflection_length_chars` | HABIT-DETAIL, ECHECK-05 |

### 4.5 Journal (P1)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `open_journal` | User opens journal | `journal_type`, `input_method`, `trigger` (home \| checkin \| nav) | HOME-*, ECHECK-05 |
| `complete_journal_entry` | User submits journal entry | `journal_type`, `input_method`, `entry_length_chars`, `prompts_answered_count`, `duration_seconds` | ECHECK-05 |
| `abandon_journal` | User starts but doesn't finish | `journal_type`, `input_method`, `time_spent_seconds` | ECHECK-05 |

### 4.6 Focus (P2)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `start_focus_session` | User starts focus timer | `linked_habit`, `duration_set_minutes`, `notification_enabled` | FOCUS-TIMER |
| `complete_focus_session` | Timer finishes naturally | `linked_habit`, `duration_minutes`, `was_interrupted` | FOCUS-TIMER |
| `abandon_focus_session` | User stops timer early | `linked_habit`, `elapsed_minutes`, `total_duration_minutes`, `completion_percentage` | FOCUS-TIMER |
| `pause_focus_session` | User pauses timer | `linked_habit`, `elapsed_minutes` | FOCUS-TIMER |

### 4.7 Notifications (P2)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `tap_notification` | User taps a notification card in the in-app feed | `id` | NOTIFICATIONS |
| `tap_notification_continue` | User taps the **Continue** action button on a daily reminder | `reminder_type` (morning_checkin \| evening_checkin \| null) | (system shade — local reminder) |
| `tap_notification_delete` | User taps the **Delete** action button on a daily reminder | `reminder_type` (morning_checkin \| evening_checkin \| null) | (system shade — local reminder) |

### 5.1 Settings (P2)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `view_settings` | User opens settings | _(none)_ | SETTINGS |
| `update_profile` | User edits profile info | `fields_changed` (list) | SETTINGS |
| `update_ai_settings` | User changes AI coaching style or voice (post-MVP per UX-14) | `setting_changed`, `old_value`, `new_value` | SETTINGS (post-MVP) |
| `update_checkin_schedule` | User changes check-in times | `checkin_type`, `old_time`, `new_time` | SETTINGS, ONBOARD-BEGINNER-09 |
| `toggle_push_notifications` | User toggles push notifications | `enabled` (boolean) | SETTINGS |
| `submit_feedback` | User submits feedback | `input_method` (voice \| text), `sentiment`, `feedback_length_chars` | HOME-* (Give Feedback button), SETTINGS |
| `tap_delete_account` | User taps delete account | _(none)_ | SETTINGS |
| `confirm_delete_account` | User confirms deletion | `days_since_signup`, `total_habits_created`, `total_checkins` | SETTINGS |
| `view_privacy_policy` | User opens privacy policy | _(none)_ | SETTINGS |

### 5.2 Insights (Phase 2, P3)

| Event Name | Trigger | Key Properties | Screens |
|---|---|---|---|
| `view_insights` | User opens Insights screen | `view_mode` (week \| month \| year) | INSIGHTS-ANALYTICS |
| `view_habit_performance` | User views habit performance | `habit_name`, `completion_rate` | INSIGHTS-ANALYTICS |
| `view_mood_correlation` | User views mood correlation chart | `correlation_domains` (list) | INSIGHTS-ANALYTICS |
| `view_checkin_history` | User views check-in history | `date_range`, `entry_count` | INSIGHTS-ANALYTICS |
| `view_calendar` | User opens calendar view | `view_type` (sleep \| energy \| mood \| stress), `month` | INSIGHTS-ANALYTICS |
| `export_insights` | User exports insight data | `format`, `date_range` | INSIGHTS-ANALYTICS |

### v6.0 NEW

| Event Name | Trigger | Key Properties | Priority | Screens |
|---|---|---|---|---|
| `llm_call` | Any LLM call via `callLLM()` wrapper | `path` (cartesia \| direct), `screen_id`, `prompt_tokens`, `response_tokens`, `latency_ms`, `delta_event_count` | P1 | All LLM-active screens |
| `mental_health_safety_triggered` | Crisis boundary fires (UX-06) | `from_screen`, `trigger_phrase_category` | P0 | CHAT, all LLM-active screens |
| `voice_cap_reached` | User hit 5 voice conversations/day cap (UX-12) | _(none)_ | P2 | VOICE-CAP |

## Total: ~73 events

- P0 (must-have): ~31
- P1: ~17
- P2: ~14
- P3: ~6
- v6.0 NEW: 3

## Decisions locked (v2 plan)

- `cartesia_latency_ms` replaces `elevenlabs_latency_ms` (Cartesia stack change).
- `checkin_type` uses `morning` \| `evening` \| `ad_hoc` (matches `ECHECK-XX`, not the doc's "night").
- All events keyed to `anon_id` per `UX-20` (not auth user_id).

## Related

- `app-session-events` — sibling system for LLM state delta.
- `app-architecture` — full PostHog vs session_log distinction.
- `app-glossary` — `lib/analytics.ts`, `track()`, `InputMethodContext`, `useVoiceSession`.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="PostHog Events"
)
```

Trigger: "refresh app-posthog-events" or "resync the sheet".

_Last refreshed: 2026-06-19_
