# PostHog Audit Checklist

> **Last verified:** 2026-05-04 — full P0 code audit pass. Semua event P0 dicek langsung terhadap source files.

Gunakan file ini untuk audit implementasi PostHog berdasarkan `posthog.txt`.

## Cara Pakai

Untuk tiap event, cek 5 hal berikut:

1. Event name sesuai taxonomy.
2. Trigger moment sesuai perilaku user.
3. Required properties lengkap dan nilainya benar.
4. Source event benar: `client`, `server`, atau `both`.
5. Event benar-benar muncul di PostHog dengan `distinct_id` yang tepat.

Status yang disarankan:

- `not_checked`
- `implemented`
- `missing`
- `partial`
- `broken`

---

## P0 Audit Checklist

### Auth

| Event                     | Trigger                     | Required Props                                         | Source | Status        | Notes                                                                                                                                                        |
| ------------------------- | --------------------------- | ------------------------------------------------------ | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `view_signup_screen`      | User membuka halaman signup | `referrer`, `utm_source`, `utm_medium`, `utm_campaign` | client | `implemented` |                                                                                                                                                              |
| `start_signup`            | User memilih metode signup  | `method`                                               | client | `implemented` | Email, Google, Apple intent                                                                                                                                  |
| `complete_signup`         | Signup berhasil             | `method`, `time_to_complete_seconds`                   | both   | `partial`     | Client tracked for email session signup and Google OAuth callback; server-side capture memerlukan Supabase Auth webhook → PostHog, ditahan sampai infra siap |
| `signup_error`            | Signup gagal                | `method`, `error_type`, `error_message`                | client | `implemented` | Email and Google error paths covered                                                                                                                         |
| `view_login_screen`       | User membuka halaman login  | -                                                      | client | `implemented` |                                                                                                                                                              |
| `complete_login`          | Login berhasil              | `method`, `is_returning_user`                          | client | `implemented` | Email and Google callback covered                                                                                                                            |
| `login_error`             | Login gagal                 | `method`, `error_type`                                 | client | `implemented` | Email and Google error paths covered                                                                                                                         |
| `tap_forgot_password`     | User klik forgot password   | -                                                      | client | `implemented` |                                                                                                                                                              |
| `complete_password_reset` | Reset password selesai      | -                                                      | client | `implemented` |                                                                                                                                                              |

### Voice Preference + Mic Permission

| Event                  | Trigger                          | Required Props         | Source | Status        | Notes                                             |
| ---------------------- | -------------------------------- | ---------------------- | ------ | ------------- | ------------------------------------------------- |
| `set_voice_preference` | User pilih voice/text preference | `preference`, `screen` | client | `implemented` | Juga set person property `ai_output_mode`         |
| `view_mic_permission`  | Screen mic permission tampil     | `ai_output_mode`       | client | `implemented` |                                                   |
| `grant_mic_permission` | User grant/deny mic              | `granted`, `dismissed` | client | `implemented` | Juga set person property `mic_permission_granted` |

### Onboarding

| Event                           | Trigger                            | Required Props                                                                            | Source | Status        | Notes                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- | ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start_onboarding`              | User masuk onboarding              | -                                                                                         | client | `implemented` | Tracked on Step 1 entry                                                                                                                                                                                                            |
| `complete_onboarding_step`      | User menyelesaikan step onboarding | `step_number`, `step_name`, `onboarding_path`, `input_method`, `time_on_step_seconds`     | client | `implemented` | Helper dipakai di beginner, advanced, dan final plan                                                                                                                                                                               |
| `select_onboarding_path`        | User memilih beginner/advanced     | `path`                                                                                    | client | `implemented` | Juga set person property `onboarding_path`                                                                                                                                                                                         |
| `complete_profile_setup`        | Profile setup selesai              | `input_method`, `fields_filled_by_voice`, `used_real_time_agent`                          | client | `implemented` | `fields_filled_by_voice` saat ini berbasis input mode aktif                                                                                                                                                                        |
| `select_improvement_areas`      | User memilih area improvement      | `areas`, `area_count`                                                                     | client | `implemented` | Beginner path step 3                                                                                                                                                                                                               |
| `select_specific_goals`         | User memilih goal spesifik         | `category`, `goals`                                                                       | client | `implemented` | Beginner path step 4                                                                                                                                                                                                               |
| `submit_voice_goals`            | User submit goal via voice         | `transcript_length_chars`, `duration_seconds`                                             | client | `implemented` | Advanced input submit tracked; `input_method` membedakan voice/manual                                                                                                                                                              |
| `view_ai_organized_plan`        | User melihat plan hasil AI         | `habits_generated_count`                                                                  | client | `implemented` | Advanced results page                                                                                                                                                                                                              |
| `tap_regenerate_plan`           | User klik regenerate plan          | `regeneration_count`                                                                      | client | `implemented` | Counter disimpan di sessionStorage                                                                                                                                                                                                 |
| `configure_habit_onboarding`    | User mengatur habit di onboarding  | `habit_name`, `category`, `has_reminder`, `frequency_days`, `input_method`                | client | `implemented` | Verified: `Step5Page.tsx` (beginner confirming phase) + `AdvancedResultsPage.tsx` (advanced confirm). `input_method` auto-injected via `track()`                                                                                   |
| `configure_journal_onboarding`  | User mengatur journaling           | `journal_type`, `prompt_count`, `input_method`                                            | client | `implemented` | Beginner dan advanced path covered                                                                                                                                                                                                 |
| `view_starting_plan`            | User melihat summary plan          | `total_habits`, `has_journal`, `onboarding_path`                                          | client | `implemented` | Plan review page                                                                                                                                                                                                                   |
| `complete_onboarding`           | User selesai onboarding            | `onboarding_path`, `total_habits`, `has_journal`, `total_time_seconds`, `steps_completed` | client | `implemented` | Tracked on Start Plan                                                                                                                                                                                                              |
| `skip_onboarding_step`          | User skip step                     | `step_number`, `step_name`                                                                | client | `missing`     | Tidak ada tombol/link skip di UI onboarding manapun — fitur belum dibuat, bukan bug tracking                                                                                                                                       |
| `drop_off_onboarding`           | User berhenti di tengah onboarding | `last_step_number`, `last_step_name`, `onboarding_path`                                   | server | `implemented` | Client `pagehide` listener di `OnboardingLayout.tsx` → `fetch('/api/onboarding/dropoff', { keepalive: true })`; server membaca state DB lalu memanggil `captureServerEvent`. Guard: skip jika `gg_onboarding_completion_in_flight` |
| `grant_notification_permission` | User grant/deny notifications      | `granted`                                                                                 | client | `implemented` | Verified: `ReminderSheet.tsx` — dipanggil saat `pushNotifications === true` dan browser Notification API di-request; juga set person property `push_notifications_enabled`                                                         |

### Daily Core Usage

| Event              | Trigger                        | Required Props                                                                                                                               | Source | Status        | Notes                                                                                                                                                                                                                              |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open_app`         | App dibuka atau tab difokuskan | `is_first_open_today`, `days_since_last_open`, `session_number`                                                                              | client | `implemented` | Verified: `openAppTracking.ts` — semua props ada, counter via localStorage `gg_last_open_date` + `gg_session_count`                                                                                                                |
| `view_home`        | Home screen render             | `habits_due_today`, `habits_completed_today`, `has_pending_checkin`                                                                          | client | `implemented` | Verified: `HomePage.tsx` — fire setelah `habitsLoading && checkInLoading` selesai, ref-guard mencegah double-fire, kirim juga `from_onboarding`                                                                                    |
| `tap_nav_item`     | User tap bottom nav            | `destination`                                                                                                                                | client | `implemented` |                                                                                                                                                                                                                                    |
| `start_checkin`    | User mulai check-in            | `checkin_type`, `input_method`, `trigger`                                                                                                    | client | `implemented` | Verified: `HomePage.tsx` — `checkin_type` dari jam (< 15 = morning), `trigger: 'home_card'`, `input_method` auto-injected via `track()`                                                                                            |
| `complete_checkin` | User submit check-in           | `checkin_type`, `input_method`, `sleep_quality`, `mood`, `energy_level`, `stress_level`, `duration_seconds`, `has_journal_entry`, `has_goal` | client | `implemented` | Verified: `CheckInCard.tsx` — semua props ada + `duration_seconds` diukur dari mount time. `has_journal_entry` dan `has_goal` hardcoded `false` (fitur belum terhubung, intentional). Juga update person property `total_checkins` |
| `abandon_checkin`  | User meninggalkan check-in     | `checkin_type`, `input_method`, `last_field_completed`, `time_spent_seconds`                                                                 | client | `implemented` |                                                                                                                                                                                                                                    |

---

## P1 Audit Checklist

### Voice Interaction

| Event                     | Trigger                              | Required Props                                                                               | Source | Status        | Notes |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- | ------ | ------------- | ----- |
| `toggle_mic`              | User mute/unmute mic                 | `new_state`, `screen`, `during_conversation`                                                 | client | `not_checked` |       |
| `play_mp3`                | MP3 pre-recorded mulai diputar       | `file_id`, `screen`, `trigger`                                                               | client | `not_checked` |       |
| `start_voice_session`     | Voice realtime mulai                 | `context`, `screen`, `voice_mode`                                                            | client | `not_checked` |       |
| `complete_voice_session`  | Voice session selesai                | `context`, `duration_seconds`, `transcript_length_chars`, `resulted_in_action`, `turn_count` | client | `not_checked` |       |
| `cancel_voice_session`    | Voice dibatalkan/error               | `context`, `duration_seconds`, `reason`                                                      | client | `not_checked` |       |
| `voice_ai_response`       | AI merespons voice input             | `context`, `response_type`, `habits_suggested_count`                                         | client | `not_checked` |       |
| `accept_voice_suggestion` | User menerima saran AI               | `context`, `suggestion_type`, `suggestion_count_accepted`, `suggestion_count_total`          | client | `not_checked` |       |
| `reject_voice_suggestion` | User reject/edit/regenerate saran AI | `context`, `suggestion_type`, `action`                                                       | client | `not_checked` |       |

### Habit

| Event                  | Trigger                      | Required Props                                                                                                                       | Source | Status        | Notes                        |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------- | ---------------------------- |
| `create_habit`         | User membuat habit baru      | `habit_name`, `category`, `subcategory`, `frequency_days`, `has_reminder`, `reminder_time`, `input_method`, `source`, `is_suggested` | both   | `not_checked` | Server-side direkomendasikan |
| `complete_habit`       | User menandai habit selesai  | `habit_name`, `category`, `current_streak`, `is_on_time`, `day_of_week`, `time_of_day`                                               | both   | `not_checked` | Server-side direkomendasikan |
| `skip_habit`           | User skip habit              | `habit_name`, `category`, `current_streak`                                                                                           | client | `not_checked` |                              |
| `snooze_habit`         | User snooze habit            | `habit_name`, `snooze_duration`                                                                                                      | client | `not_checked` |                              |
| `edit_habit`           | User edit habit              | `habit_name`, `fields_changed`, `input_method`                                                                                       | client | `not_checked` |                              |
| `delete_habit`         | User delete habit            | `habit_name`, `category`, `lifetime_days`, `total_completions`, `completion_rate`                                                    | both   | `not_checked` | Server-side direkomendasikan |
| `view_habit_detail`    | User buka detail habit       | `habit_name`, `category`, `current_streak`, `completion_rate`                                                                        | client | `not_checked` |                              |
| `log_habit_reflection` | User submit reflection habit | `habit_name`, `input_method`, `reflection_length_chars`                                                                              | client | `not_checked` |                              |

### Journal

| Event                    | Trigger                   | Required Props                                                                                     | Source | Status        | Notes                        |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------- | ------ | ------------- | ---------------------------- |
| `open_journal`           | User membuka journal      | `journal_type`, `input_method`, `trigger`                                                          | client | `not_checked` |                              |
| `complete_journal_entry` | User submit journal entry | `journal_type`, `input_method`, `entry_length_chars`, `prompts_answered_count`, `duration_seconds` | both   | `not_checked` | Server-side direkomendasikan |
| `abandon_journal`        | User meninggalkan journal | `journal_type`, `input_method`, `time_spent_seconds`                                               | client | `not_checked` |                              |

---

## P2 Audit Checklist

| Event                       | Trigger                        | Required Props                                                                       | Source | Status        | Notes                        |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ | ------ | ------------- | ---------------------------- |
| `start_focus_session`       | User mulai focus timer         | `linked_habit`, `duration_set_minutes`, `notification_enabled`                       | client | `not_checked` |                              |
| `complete_focus_session`    | Timer selesai natural          | `linked_habit`, `duration_minutes`, `was_interrupted`                                | client | `not_checked` |                              |
| `abandon_focus_session`     | User stop timer lebih awal     | `linked_habit`, `elapsed_minutes`, `total_duration_minutes`, `completion_percentage` | client | `not_checked` |                              |
| `pause_focus_session`       | User pause timer               | `linked_habit`, `elapsed_minutes`                                                    | client | `not_checked` |                              |
| `view_settings`             | User buka settings             | -                                                                                    | client | `not_checked` |                              |
| `update_profile`            | User update profile            | `fields_changed`                                                                     | client | `not_checked` |                              |
| `update_ai_settings`        | User ubah AI settings          | `setting_changed`, `old_value`, `new_value`                                          | client | `not_checked` |                              |
| `update_checkin_schedule`   | User ubah jadwal check-in      | `checkin_type`, `old_time`, `new_time`                                               | client | `not_checked` |                              |
| `toggle_push_notifications` | User toggle push notifications | `enabled`                                                                            | client | `not_checked` |                              |
| `submit_feedback`           | User submit feedback           | `input_method`, `sentiment`, `feedback_length_chars`                                 | client | `not_checked` |                              |
| `tap_delete_account`        | User klik delete account       | -                                                                                    | client | `not_checked` |                              |
| `confirm_delete_account`    | User konfirmasi delete account | `days_since_signup`, `total_habits_created`, `total_checkins`                        | both   | `not_checked` | Server-side direkomendasikan |
| `view_privacy_policy`       | User buka privacy policy       | -                                                                                    | client | `not_checked` |                              |

---

## P3 Audit Checklist

| Event                    | Trigger                        | Required Props                  | Source | Status        | Notes  |
| ------------------------ | ------------------------------ | ------------------------------- | ------ | ------------- | ------ |
| `view_insights`          | User buka insights             | `view_mode`                     | client | `not_checked` | Future |
| `view_habit_performance` | User lihat performance habit   | `habit_name`, `completion_rate` | client | `not_checked` | Future |
| `view_mood_correlation`  | User lihat chart korelasi mood | `correlation_domains`           | client | `not_checked` | Future |
| `view_checkin_history`   | User lihat history check-in    | `date_range`, `entry_count`     | client | `not_checked` | Future |
| `view_calendar`          | User buka calendar             | `view_type`, `month`            | client | `not_checked` | Future |
| `export_insights`        | User export insight data       | `format`, `date_range`          | client | `not_checked` | Future |

---

## Minimal Identity Audit

Ini bukan event, tapi wajib dicek juga saat audit.

| Property                     | Set When                        | Expected Source  | Status        | Notes                                  |
| ---------------------------- | ------------------------------- | ---------------- | ------------- | -------------------------------------- |
| `$email`                     | Setelah signup / identify       | client           | `implemented` | Set during identify                    |
| `$name`                      | Setelah profile setup           | client           | `implemented` | Set during identify and Step 1         |
| `auth_method`                | Setelah signup/login            | client           | `implemented` | Email and Google flows covered         |
| `plan_tier`                  | Setelah identify user           | client           | `implemented` | Default `free`                         |
| `ai_output_mode`             | Setelah pilih voice preference  | client           | `implemented` |                                        |
| `mic_permission_granted`     | Setelah grant/deny mic          | client           | `implemented` |                                        |
| `onboarding_path`            | Setelah pilih beginner/advanced | client           | `implemented` |                                        |
| `selected_areas`             | Setelah pilih area improvement  | client           | `implemented` |                                        |
| `active_habits_count`        | Setelah create/delete habit     | client or server | `partial`     | Set on onboarding completion only      |
| `push_notifications_enabled` | Setelah toggle notification     | client           | `implemented` | Set saat reminder preferences disimpan |
| `total_checkins`             | Setelah complete check-in       | client or server | `implemented` | Diupdate client-side via local counter |
| `total_voice_sessions`       | Setelah voice session selesai   | client or server | `missing`     |                                        |

---

## Audit Workflow

Urutan audit yang disarankan:

1. Audit `P0` dulu sampai stabil.
2. Pastikan event muncul di PostHog dan props-nya benar.
3. Cek identity dan user properties.
4. Lanjut `P1`.
5. Baru audit reliability untuk event yang direkomendasikan server-side.
