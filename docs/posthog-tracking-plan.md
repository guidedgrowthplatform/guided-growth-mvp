# 📊 PostHog Event Tracking Plan — Guided Growth OS

> **Version:** v6.0  
> **Last Updated:** 2026-05-05  
> **Source:** [Guided Growth OS App Master – Google Sheets](https://docs.google.com/spreadsheets/d/1aI2sVEsFPdEJIEKho5LaB_nEHJvvhSrTktfYKZM0yT0/edit?gid=1407765747#gid=1407765747)  
> **Branch:** `feat/posthog-tracking-plan`  
> **Total Events (from sheet):** 70 | **Expert Additions:** 14 | **Grand Total:** 84

---

## 📌 Overview

This document is the **single source of truth** for all PostHog event tracking in the Guided Growth OS app. It defines every event that must be fired, the properties attached, the screen it fires from, and the priority level.

### Priority Legend

| Priority | Meaning                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| **P0**   | Critical — must fire correctly on Day 1 (auth, onboarding, safety, retention) |
| **P1**   | High — core product actions (habit, voice, check-in, journal)                 |
| **P2**   | Medium — settings, focus, notifications, deep links                           |
| **P3**   | Low — analytics & insights views                                              |

### Property Conventions

- All event names use **`snake_case`**
- Boolean values are sent as `true` / `false` (not `"yes"/"no"`)
- Duration values are always in **seconds** unless the property name says `_minutes` or `_ms`
- Enum string values are **lowercase** (e.g. `"apple"`, `"beginner"`)
- All events automatically include PostHog's standard auto-captured properties: `$device_type`, `$os`, `$app_version`, `$lib_version`, `distinct_id`

---

## 🔐 3.1 Auth

> **Goal:** Understand the signup/login funnel, identify drop-off points, and track error rates per method.  
> **Key Funnel:** `view_signup_screen` → `start_signup` → `complete_signup`

| #   | Event Name                | Trigger                      | Key Properties                                         | Priority | Screen(s)           |
| --- | ------------------------- | ---------------------------- | ------------------------------------------------------ | -------- | ------------------- |
| 1   | `view_signup_screen`      | User lands on signup screen  | `referrer`, `utm_source`, `utm_medium`, `utm_campaign` | **P0**   | WELCOME-01, AUTH-01 |
| 2   | `start_signup`            | User taps a signup method    | `method` _(apple \| google \| email)_                  | **P0**   | WELCOME-01, AUTH-01 |
| 3   | `complete_signup`         | Account successfully created | `method`, `time_to_complete_seconds`                   | **P0**   | AUTH-01             |
| 4   | `signup_error`            | Signup fails                 | `method`, `error_type`, `error_message`                | **P0**   | AUTH-01             |
| 5   | `view_login_screen`       | User lands on login screen   | _(none)_                                               | **P0**   | AUTH-02             |
| 6   | `complete_login`          | User logs in successfully    | `method`, `is_returning_user`                          | **P0**   | AUTH-02             |
| 7   | `login_error`             | Login fails                  | `method`, `error_type`                                 | **P0**   | AUTH-02             |
| 8   | `tap_forgot_password`     | User taps Forgot Password    | _(none)_                                               | **P0**   | AUTH-02             |
| 9   | `complete_password_reset` | Password reset completed     | _(none)_                                               | **P0**   | AUTH-02             |

> **💡 Analytics Tip:** Build a PostHog Funnel: `view_signup_screen` → `start_signup` → `complete_signup`. Any conversion drop > 15% between steps warrants a UX audit. Use `method` breakdown to compare Apple vs Google vs Email conversion.

---

## 🧭 3.2 Onboarding

> **Goal:** Measure path selection, per-step completion, drop-off, and permission grant rates to optimize onboarding conversion.  
> **Key Funnel:** `start_onboarding` → `complete_onboarding_step` (×N) → `complete_onboarding`

| #   | Event Name                      | Trigger                                     | Key Properties                                                                                | Priority | Screen(s)                 |
| --- | ------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- | ------------------------- |
| 10  | `start_onboarding`              | User enters onboarding after signup         | _(none)_                                                                                      | **P0**   | POST-AUTH-01 → ONBOARD-01 |
| 11  | `complete_onboarding_step`      | User completes any onboarding step          | `step_number` _(1-7)_, `step_name`, `onboarding_path`, `input_method`, `time_on_step_seconds` | **P0**   | ONBOARD-01..09            |
| 12  | `select_onboarding_path`        | User picks Beginner or Advanced             | `path` _(beginner \| advanced)_                                                               | **P0**   | ONBOARD-02                |
| 13  | `select_improvement_areas`      | Beginner: picks areas to improve            | `areas` _(list)_, `area_count`                                                                | **P0**   | ONBOARD-03                |
| 14  | `select_specific_goals`         | Beginner: narrows down goals                | `category`, `goals` _(list)_                                                                  | **P0**   | ONBOARD-04                |
| 15  | `submit_voice_goals`            | Advanced: submits voice input               | `transcript_length_chars`, `duration_seconds`                                                 | **P0**   | ADV-01                    |
| 16  | `view_ai_organized_plan`        | Advanced: sees AI-generated habits          | `habits_generated_count`                                                                      | **P0**   | ADV-02                    |
| 17  | `tap_regenerate_plan`           | Advanced: taps Regenerate from scratch      | `regeneration_count`                                                                          | **P0**   | ADV-02                    |
| 18  | `configure_habit_onboarding`    | User configures a habit during onboarding   | `habit_name`, `category`, `has_reminder`, `frequency_days`, `input_method`                    | **P0**   | ONBOARD-06                |
| 19  | `configure_journal_onboarding`  | User sets up journaling                     | `journal_type`, `prompt_count`, `input_method`                                                | **P0**   | ONBOARD-08                |
| 20  | `view_starting_plan`            | User sees the plan summary screen           | `total_habits`, `has_journal`, `onboarding_path`                                              | **P0**   | ONBOARD-09                |
| 21  | `complete_onboarding`           | User taps "Start Plan"                      | `onboarding_path`, `total_habits`, `has_journal`, `total_time_seconds`, `steps_completed`     | **P0**   | ONBOARD-09                |
| 22  | `skip_onboarding_step`          | User skips a step                           | `step_number`, `step_name`                                                                    | **P0**   | ONBOARD-01..09            |
| 23  | `drop_off_onboarding`           | User leaves during onboarding               | `last_step_number`, `last_step_name`, `onboarding_path`                                       | **P0**   | ONBOARD-01..09            |
| 24  | `grant_notification_permission` | User grants/denies push notification access | `granted` _(boolean)_                                                                         | **P0**   | REMIND-01                 |
| 25  | `grant_mic_permission`          | User grants/denies microphone access        | `granted` _(boolean)_                                                                         | **P0**   | MIC-01                    |

> **💡 Analytics Tip:** Use PostHog's **Retention** tool on `complete_onboarding` vs `complete_checkin` (Day 7). Users who finish onboarding but don't check in within 7 days are your highest churn risk. Use `drop_off_onboarding.last_step_name` to find the exact step causing the most abandonment.

---

## 🏠 4.1 Home & Navigation

> **Goal:** Measure session frequency, understand feature discovery via nav taps, and identify the most/least visited screens.

| #   | Event Name     | Trigger                         | Key Properties                                                      | Priority | Screen(s)  |
| --- | -------------- | ------------------------------- | ------------------------------------------------------------------- | -------- | ---------- |
| 26  | `open_app`     | App opens / tab gains focus     | `is_first_open_today`, `days_since_last_open`, `session_number`     | **P0**   | _(global)_ |
| 27  | `view_home`    | Home screen rendered            | `habits_due_today`, `habits_completed_today`, `has_pending_checkin` | **P0**   | HOME-\*    |
| 28  | `tap_nav_item` | User taps bottom navigation bar | `destination` _(home \| progress \| voice \| insights \| profile)_  | **P0**   | _(global)_ |

> **💡 Analytics Tip:** Create a PostHog Trends chart for `tap_nav_item` grouped by `destination`. Low taps on a feature = low discovery. The `days_since_last_open` in `open_app` is your D1/D7/D30 retention raw material.

---

## ✅ 4.2 Check-in

> **Goal:** Track morning/evening check-in habit formation. Identify fields most frequently abandoned and optimize the check-in UX.  
> **Key Funnel:** `start_checkin` → `complete_checkin` (measure `abandon_checkin` drop-off)

| #   | Event Name         | Trigger                        | Key Properties                                                                                         | Priority | Screen(s)                |
| --- | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- | ------------------------ |
| 29  | `start_checkin`    | User opens check-in flow       | `checkin_type` _(morning \| evening)_, `input_method`, `trigger` _(reminder \| manual \| home_prompt)_ | **P0**   | MCHECK-01, ECHECK-01     |
| 30  | `complete_checkin` | User submits check-in          | `checkin_type`, `sleep_quality`, `mood`, `energy_level`, `stress_level`, `duration_seconds`            | **P0**   | MCHECK-01, ECHECK-06     |
| 31  | `abandon_checkin`  | User starts but doesn't finish | `checkin_type`, `input_method`, `last_field_completed`, `time_spent_seconds`                           | **P0**   | MCHECK-01, ECHECK-01..06 |

> **💡 Analytics Tip:** Correlate `complete_checkin` frequency with `complete_habit` rate using PostHog **Correlation Analysis**. This directly proves the product's core value hypothesis: consistent check-ins lead to better habit completion.

---

## 🎙️ 4.3 Voice

> **Goal:** Measure voice feature adoption, AI response quality, and Cartesia latency impact on user behavior.  
> **Key Funnel:** `start_voice_session` → `complete_voice_session` → `accept_voice_suggestion`

| #   | Event Name                | Trigger                           | Key Properties                                                           | Priority | Screen(s) |
| --- | ------------------------- | --------------------------------- | ------------------------------------------------------------------------ | -------- | --------- |
| 32  | `start_voice_session`     | User taps the mic button anywhere | `context`, `screen`                                                      | **P1**   | VOICE-01  |
| 33  | `complete_voice_session`  | Voice transcription completes     | `context`, `duration_seconds`, `transcript_length`, `resulted_in_action` | **P1**   | VOICE-01  |
| 34  | `cancel_voice_session`    | User cancels voice recording      | `context`, `duration_seconds`, `reason`                                  | **P1**   | VOICE-01  |
| 35  | `voice_ai_response`       | AI responds to voice input        | `context`, `response_type`, `habits_suggested_count`                     | **P1**   | VOICE-01  |
| 36  | `accept_voice_suggestion` | User accepts AI suggestion        | `context`, `suggestion_type`, `suggestion_count_accepted`                | **P1**   | VOICE-01  |
| 37  | `reject_voice_suggestion` | User rejects or edits suggestion  | `context`, `suggestion_type`, `action` _(edit \| reject \| regenerate)_  | **P1**   | VOICE-01  |

> **💡 Analytics Tip:** High drop-off at `complete_voice_session` with `reason: error` = Cartesia reliability issue. Alert on this immediately. The `resulted_in_action` boolean in `complete_voice_session` is your Voice-to-Action conversion metric.

---

## 🏋️ 4.4 Habit

> **Goal:** Measure habit creation, completion streaks, skip patterns, and long-term retention of habits.

| #   | Event Name             | Trigger                           | Key Properties                                                                                                | Priority | Screen(s)               |
| --- | ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- | ----------------------- |
| 38  | `create_habit`         | New habit created                 | `habit_name`, `category`, `frequency_days`, `has_reminder`, `source` _(manual \| ai_suggested \| onboarding)_ | **P1**   | HABIT-ADD, VOICE-01     |
| 39  | `complete_habit`       | User marks a habit as done        | `habit_name`, `category`, `current_streak`, `is_on_time`                                                      | **P1**   | HOME-_, ECHECK-_        |
| 40  | `skip_habit`           | User skips a habit                | `habit_name`, `category`, `current_streak`                                                                    | **P1**   | HOME-_, ECHECK-_        |
| 41  | `snooze_habit`         | User snoozes a habit reminder     | `habit_name`, `snooze_duration`                                                                               | **P1**   | HOME-\*                 |
| 42  | `edit_habit`           | User edits a habit                | `habit_name`, `fields_changed`, `input_method`                                                                | **P1**   | HABIT-EDIT, VOICE-01    |
| 43  | `delete_habit`         | User deletes a habit              | `habit_name`, `lifetime_days`, `total_completions`                                                            | **P1**   | HABIT-EDIT, VOICE-01    |
| 44  | `view_habit_detail`    | User opens habit detail screen    | `habit_name`, `category`, `completion_rate`                                                                   | **P1**   | HABIT-DETAIL            |
| 45  | `log_habit_reflection` | User logs a reflection on a habit | `habit_name`, `input_method`, `reflection_length_chars`                                                       | **P1**   | HABIT-DETAIL, ECHECK-05 |

> **💡 Analytics Tip:** Track `delete_habit` where `lifetime_days < 7`. High early-delete rate in a specific category = bad suggested configuration in onboarding. Use `source` breakdown to compare habit retention for `ai_suggested` vs `manual` habits.

---

## 📓 4.5 Journal

> **Goal:** Understand journaling behavior, entry completion rates, and preferred input methods.

| #   | Event Name               | Trigger                        | Key Properties                                                               | Priority | Screen(s)          |
| --- | ------------------------ | ------------------------------ | ---------------------------------------------------------------------------- | -------- | ------------------ |
| 46  | `open_journal`           | User opens journal             | `journal_type`, `input_method`, `trigger` _(nav \| checkin \| habit_prompt)_ | **P1**   | HOME-\*, ECHECK-05 |
| 47  | `complete_journal_entry` | User submits a journal entry   | `journal_type`, `input_method`, `entry_length_chars`, `prompts_answered`     | **P1**   | ECHECK-05          |
| 48  | `abandon_journal`        | User starts but doesn't finish | `journal_type`, `time_spent_seconds`                                         | **P1**   | ECHECK-05          |

---

## ⏱️ 4.6 Focus

> **Goal:** Measure focus session adoption, completion rates, and correlate with habit completion.

| #   | Event Name               | Trigger                  | Key Properties                                             | Priority | Screen(s) |
| --- | ------------------------ | ------------------------ | ---------------------------------------------------------- | -------- | --------- |
| 49  | `start_focus_session`    | User starts focus timer  | `linked_habit`, `duration_set_minutes`                     | **P2**   | FOCUS-01  |
| 50  | `complete_focus_session` | Timer finishes naturally | `linked_habit`, `duration_minutes`, `was_interrupted`      | **P2**   | FOCUS-01  |
| 51  | `abandon_focus_session`  | User stops timer early   | `linked_habit`, `elapsed_minutes`, `completion_percentage` | **P2**   | FOCUS-01  |
| 52  | `pause_focus_session`    | User pauses the timer    | `linked_habit`, `elapsed_minutes`                          | **P2**   | FOCUS-01  |

---

## ⚙️ 5.1 Settings

> **Goal:** Measure settings engagement, AI preference changes, and critically — account deletion (churn signal).

| #   | Event Name                  | Trigger                                | Key Properties                                        | Priority | Screen(s)   |
| --- | --------------------------- | -------------------------------------- | ----------------------------------------------------- | -------- | ----------- |
| 53  | `view_settings`             | User opens settings screen             | _(none)_                                              | **P2**   | SETTINGS-01 |
| 54  | `update_profile`            | User edits profile information         | `fields_changed`                                      | **P2**   | SETTINGS-01 |
| 55  | `update_ai_settings`        | User changes AI coaching style/voice   | `setting_changed`, `old_value`, `new_value`           | **P2**   | SETTINGS-01 |
| 56  | `update_checkin_schedule`   | User changes check-in times            | `checkin_type`, `old_time`, `new_time`                | **P2**   | SETTINGS-01 |
| 57  | `toggle_push_notifications` | User toggles push notifications on/off | `enabled` _(boolean)_                                 | **P2**   | SETTINGS-01 |
| 58  | `submit_feedback`           | User submits in-app feedback           | `input_method`, `sentiment`, `feedback_length`        | **P2**   | SETTINGS-01 |
| 59  | `tap_delete_account`        | User taps Delete Account button        | _(none)_                                              | **P2**   | SETTINGS-01 |
| 60  | `confirm_delete_account`    | User confirms account deletion         | `days_since_signup`, `total_habits`, `total_checkins` | **P2**   | SETTINGS-01 |
| 61  | `view_privacy_policy`       | User opens privacy policy              | _(none)_                                              | **P2**   | SETTINGS-01 |

> **💡 Analytics Tip:** `tap_delete_account` without `confirm_delete_account` = exit intent churn signal. These users are the perfect cohort for a win-back survey. Capture `days_since_signup` and `total_habits` on `confirm_delete_account` to understand **who** churns.

---

## 📈 5.2 Insights & Analytics Screens

> **Goal:** Understand how users consume their own data, which views drive re-engagement, and export behavior.

| #   | Event Name               | Trigger                            | Key Properties                        | Priority | Screen(s)  |
| --- | ------------------------ | ---------------------------------- | ------------------------------------- | -------- | ---------- |
| 62  | `view_insights`          | User opens Insights screen         | `view_mode` _(week \| month \| year)_ | **P3**   | INSIGHT-01 |
| 63  | `view_habit_performance` | User views habit performance chart | `habit_name`, `completion_rate`       | **P3**   | INSIGHT-01 |
| 64  | `view_mood_correlation`  | User views mood correlation chart  | `correlation_domains`                 | **P3**   | INSIGHT-01 |
| 65  | `view_checkin_history`   | User views check-in history        | `date_range`, `entry_count`           | **P3**   | INSIGHT-01 |
| 66  | `view_calendar`          | User opens calendar view           | `view_type`, `month`                  | **P3**   | INSIGHT-01 |
| 67  | `export_insights`        | User exports insight data          | `format` _(pdf \| csv)_, `date_range` | **P3**   | INSIGHT-01 |

---

## 🆕 v6.0 — New Technical & Safety Events

| #   | Event Name                       | Trigger                                   | Key Properties                                                    | Priority | Screen(s)       |
| --- | -------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- | -------- | --------------- |
| 68  | `llm_call`                       | Any LLM call via the backend wrapper      | `screen_id`, `tokens`, `latency_ms`, `delta_event_count`, `model` | **P1**   | All LLM screens |
| 69  | `mental_health_safety_triggered` | Crisis boundary fires (UX-06)             | `from_screen`, `trigger_phrase_category`                          | **P0**   | VOICE-01        |
| 70  | `voice_cap_reached`              | User hits 5 voice conversations/day limit | _(none)_                                                          | **P2**   | VOICE-CAP       |

---

## ➕ Expert Analytics Additions

> Events below are **not in the original sheet** but are strongly recommended by analytics best practices to fill blind spots and make the data fully actionable.

### 🔁 Session & App Health

| #   | Event Name                 | Trigger                                                   | Key Properties                                                             | Priority |
| --- | -------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| 71  | `session_end`              | App goes to background / user closes                      | `session_duration_seconds`, `screens_visited_count`, `actions_taken_count` | **P1**   |
| 72  | `app_updated`              | App detects it's running a new version for the first time | `previous_version`, `new_version`                                          | **P1**   |
| 73  | `error_boundary_triggered` | React error boundary catches unhandled UI error           | `component_name`, `error_message`, `screen`                                | **P0**   |
| 74  | `network_quality_degraded` | Network drops below threshold during active session       | `context` _(voice \| checkin)_, `effective_type` _(2g \| 3g \| offline)_   | **P1**   |

> **Why #71:** Without `session_end`, session duration is estimated from inactivity timeouts and is inaccurate. `error_boundary_triggered` (#73) lets you correlate technical crashes with churn in PostHog Correlation Analysis.

### 🔔 Notifications & Re-engagement

| #   | Event Name               | Trigger                                      | Key Properties                                                                  | Priority |
| --- | ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| 75  | `notification_tapped`    | User taps a push notification to open app    | `notification_type` _(habit_reminder \| checkin \| motivational)_, `habit_name` | **P1**   |
| 76  | `notification_dismissed` | User dismisses a push without opening        | `notification_type`                                                             | **P2**   |
| 77  | `deep_link_opened`       | User enters app via a deep link / URL scheme | `source`, `campaign`, `target_screen`                                           | **P2**   |

> **Why:** Knowing _which_ notification types drive `open_app` vs which are ignored is critical for optimizing re-engagement. Calculate: `notification_tapped / (notification_tapped + notification_dismissed)` = **Notification CTR** per type.

### 🤖 AI & Content Quality

| #   | Event Name                      | Trigger                                    | Key Properties                                                     | Priority |
| --- | ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | -------- |
| 78  | `ai_transcription_retry`        | User taps mic again after a voice failure  | `context`, `error_type`, `attempt_number`                          | **P1**   |
| 79  | `ai_coaching_message_shown`     | App displays an AI coaching tip            | `message_type`, `context`, `trigger` _(scheduled \| event_driven)_ | **P2**   |
| 80  | `ai_coaching_message_tapped`    | User taps/engages with AI coaching message | `message_type`, `action_taken`                                     | **P2**   |
| 81  | `ai_coaching_message_dismissed` | User dismisses AI coaching message         | `message_type`                                                     | **P2**   |

> **Why #78:** `ai_transcription_retry` is the clearest signal of user frustration in your core voice UX. A high `attempt_number` means Cartesia is failing silently. Track message CTR: `ai_coaching_message_tapped / ai_coaching_message_shown` per `message_type` → A/B test copy with PostHog **Experiments**.

### ⚡ Streak & Gamification

| #   | Event Name                 | Trigger                               | Key Properties                                                            | Priority |
| --- | -------------------------- | ------------------------------------- | ------------------------------------------------------------------------- | -------- |
| 82  | `streak_milestone_reached` | User reaches a habit streak milestone | `habit_name`, `streak_count` _(7 \| 14 \| 30 \| 60 \| 100)_, `category`   | **P1**   |
| 83  | `streak_broken`            | A user's habit streak resets to 0     | `habit_name`, `previous_streak`, `category`, `days_since_last_completion` | **P1**   |

> **Why #83 is critical:** `streak_broken` is a **leading churn indicator**. Users whose streaks break and who don't `complete_habit` in the next 48 hours have significantly higher 30-day churn. This event should trigger a re-engagement automation in PostHog → Zapier → push notification.

### 📱 User Lifecycle

| #   | Event Name                    | Trigger                               | Key Properties                                                              | Priority |
| --- | ----------------------------- | ------------------------------------- | --------------------------------------------------------------------------- | -------- |
| 84  | `retention_milestone_reached` | User reaches 7, 30, or 90 active days | `milestone_days` _(7 \| 30 \| 90)_, `total_habits_active`, `longest_streak` | **P1**   |

> **Why:** Milestone events are the building blocks of Lifecycle Cohorts in PostHog. Comparing behavior of users who hit Day 30 vs those who don't is the most powerful product insight available.

---

## 🏗️ PostHog Implementation Guide

### Recommended Dashboards to Build

| Dashboard                  | Key Events                                                                       | Purpose                                         |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Onboarding Funnel**      | #1 → #3 → #10 → #21                                                              | Track signup-to-activation conversion rate      |
| **Core Loop Health**       | `open_app`, `complete_checkin`, `complete_habit`                                 | Daily active user health & habit loop integrity |
| **Voice Feature Adoption** | `start_voice_session` → `complete_voice_session` → `accept_voice_suggestion`     | Voice funnel & AI suggestion quality            |
| **Churn Early Warning**    | `abandon_checkin`, `skip_habit`, `streak_broken`, `tap_delete_account`           | Proactive churn detection cohort                |
| **Technical Health**       | `error_boundary_triggered`, `network_quality_degraded`, `ai_transcription_retry` | App stability & reliability monitor             |
| **LLM Cost & Performance** | `llm_call` grouped by `model`, `latency_ms`, `tokens`                            | AI cost control & performance SLA               |

### Recommended Cohorts

```
Cohort: "Advanced Onboarding Users"       → path = "advanced" on select_onboarding_path
Cohort: "7-Day Streak Holders"            → streak_milestone_reached with streak_count = 7
Cohort: "Voice Power Users"               → complete_voice_session count >= 5 in last 30 days
Cohort: "At-Risk Users"                   → streak_broken in last 3 days + no complete_habit since
Cohort: "Silent Churners"                 → open_app not fired in last 7 days
Cohort: "Notification-Driven Users"       → notification_tapped count >= 3 in last 14 days
```

### User Identity (`posthog.identify`)

Call `posthog.identify()` after `complete_login` and `complete_signup`:

```typescript
posthog.identify(userId, {
  email: user.email,
  name: user.name,
  onboarding_path: 'beginner' | 'advanced', // set once at complete_onboarding
  total_habits_active: number, // update on create/delete_habit
  longest_streak: number, // update on streak_milestone_reached
  subscription_status: 'free' | 'premium',
  app_version: string,
  platform: 'ios' | 'android' | 'web',
  created_at: string, // ISO 8601
});
```

### Session Boundaries

```typescript
// App enters foreground
posthog.capture('open_app', {
  is_first_open_today: boolean,
  days_since_last_open: number,
  session_number: number,
});

// App goes to background
posthog.capture('session_end', {
  session_duration_seconds: number,
  screens_visited_count: number,
  actions_taken_count: number,
});

// On logout or account deletion — clear PostHog identity
posthog.reset();
```

### Recommended Feature Flags

```
flag: "voice_ai_v2"               → A/B test new voice AI model (Cartesia upgrade)
flag: "streak_recovery_prompt"    → Show "recover your streak" CTA after streak_broken
flag: "onboarding_v2"             → Test new onboarding path ordering
flag: "ai_coaching_banner"        → A/B test coaching message format (card vs toast)
flag: "checkin_voice_default"     → Test defaulting check-in to voice input
```

---

## ✅ Implementation Checklist

### Setup

- [ ] Install PostHog SDK (`posthog-js` for web, native SDK for mobile)
- [ ] Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to `.env.local`
- [ ] Initialize PostHog in `main.tsx` / app entry point
- [ ] Configure Ingestion Filters to block internal team IPs/emails

### Identity

- [ ] Call `posthog.identify()` after `complete_login` and `complete_signup`
- [ ] Call `posthog.reset()` on logout and after `confirm_delete_account`

### Event Implementation (by priority)

- [ ] **P0 Events** (#1–#9 Auth, #10–#25 Onboarding, #26–#31 Core, #69 Safety, #73 Error)
- [ ] **P1 Events** (#32–#48 Core Loop, #68 LLM, #71–#72, #74–#75, #78, #82–#84)
- [ ] **P2 Events** (#49–#61 Settings & Focus, #70, #76–#77, #79–#81)
- [ ] **P3 Events** (#62–#67 Insights)

### PostHog UI Setup

- [ ] Create the 6 recommended Dashboards
- [ ] Set up the 6 recommended Cohorts
- [ ] Configure `mental_health_safety_triggered` Alert (P0 — notify on-call immediately)
- [ ] Configure `error_boundary_triggered` spike Alert
- [ ] QA all P0 events in PostHog **Live Events** tab before merging to `main`

---

_Document maintained by the Engineering team. Any new feature that adds user-facing interactions **MUST** add its events to this document BEFORE implementation begins._
