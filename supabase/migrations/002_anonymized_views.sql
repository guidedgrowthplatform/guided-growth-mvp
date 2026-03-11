-- ═══════════════════════════════════════════════════════════════════
-- Guided Growth — Anonymized Views for Analytics (MVP-19, #43)
-- ───────────────────────────────────────────────────────────────────
-- These views expose data with PII hashed for admin analytics.
-- Mood, dates, frequencies, and stats are preserved (not PII).
-- Text fields (names, content, notes) are SHA-256 hashed.
-- ═══════════════════════════════════════════════════════════════════

-- Enable pgcrypto for sha256
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Anonymized Habits ───
CREATE OR REPLACE VIEW anonymized_habits AS
SELECT
  id,
  user_id,
  'habit_' || left(encode(digest(name, 'sha256'), 'hex'), 8) AS name,
  habit_type,
  cadence,
  is_active,
  created_at
FROM user_habits;

-- ─── Anonymized Journal Entries ───
CREATE OR REPLACE VIEW anonymized_journal AS
SELECT
  id,
  user_id,
  date,
  'journal_' || left(encode(digest(response, 'sha256'), 'hex'), 8) AS response,
  input_mode,
  time_of_day,
  created_at
FROM journal_entries;

-- ─── Anonymized Daily Check-ins ───
CREATE OR REPLACE VIEW anonymized_checkins AS
SELECT
  id,
  user_id,
  date,
  mood,
  energy_level,
  stress_level,
  sleep_quality,
  sleep_hours,
  CASE WHEN notes IS NOT NULL
    THEN 'note_' || left(encode(digest(notes, 'sha256'), 'hex'), 8)
    ELSE NULL
  END AS notes,
  created_at
FROM daily_checkins;

-- ─── Anonymized Users ───
CREATE OR REPLACE VIEW anonymized_users AS
SELECT
  id,
  'user_' || left(encode(digest(email::bytea, 'sha256'), 'hex'), 8) || '@anon' AS email,
  'anon_' || left(encode(digest(nickname::bytea, 'sha256'), 'hex'), 8) AS nickname,
  age_group,
  gender,
  language,
  created_at
FROM users;

-- ─── Anonymized Habit Completions (with notes hashed) ───
CREATE OR REPLACE VIEW anonymized_completions AS
SELECT
  hc.id,
  hc.user_habit_id,
  hc.date,
  hc.completed,
  hc.completed_via,
  CASE WHEN hc.notes IS NOT NULL
    THEN 'note_' || left(encode(digest(hc.notes, 'sha256'), 'hex'), 8)
    ELSE NULL
  END AS notes,
  hc.created_at
FROM habit_completions hc;

-- ─── Anonymized Onboarding (brain dump hashed) ───
CREATE OR REPLACE VIEW anonymized_onboarding AS
SELECT
  id,
  user_id,
  path,
  goal_type,
  trigger_context,
  CASE WHEN brain_dump_raw IS NOT NULL
    THEN 'braindump_' || left(encode(digest(brain_dump_raw, 'sha256'), 'hex'), 8)
    ELSE NULL
  END AS brain_dump_raw,
  current_step,
  completed_at,
  created_at
FROM onboarding_states;

-- ─── Anonymized Tracked Metrics ───
CREATE OR REPLACE VIEW anonymized_metrics AS
SELECT
  id,
  user_id,
  'metric_' || left(encode(digest(name, 'sha256'), 'hex'), 8) AS name,
  input_type,
  frequency,
  scale_min,
  scale_max,
  is_active,
  created_at
FROM user_tracked_metrics;
