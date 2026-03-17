-- ═══════════════════════════════════════════════════════════════════
-- Guided Growth — Supabase Migration
-- ───────────────────────────────────────────────────────────────────
-- Version  : v4 (from schema.dbml)
-- Target   : Supabase (PostgreSQL 15+)
-- Usage    : Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────
-- 1. USERS & AUTHENTICATION
-- ─────────────────────────────────────────
-- Note: Supabase Auth manages auth.users internally.
-- This table stores app-specific profile data, linked via id = auth.uid()

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  auth_provider VARCHAR NOT NULL CHECK (auth_provider IN ('email', 'google', 'apple')),
  terms_accepted_at TIMESTAMPTZ NOT NULL,

  -- Profile (onboarding Step 1)
  nickname VARCHAR NOT NULL,
  age_group VARCHAR NOT NULL CHECK (age_group IN ('14_or_under', '15_19', '20_24', '25_29', '30_plus')),
  gender VARCHAR NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  language VARCHAR NOT NULL DEFAULT 'en',
  avatar_url VARCHAR,

  -- Daily schedule (onboarding Step 3)
  morning_wakeup_time TIME DEFAULT '07:00',
  night_winddown_time TIME DEFAULT '22:00',

  -- Onboarding state
  onboarding_path VARCHAR CHECK (onboarding_path IN ('keep_it_simple', 'build_my_plan', 'brain_dump')),
  onboarding_completed_at TIMESTAMPTZ,
  tutorial_completed BOOLEAN DEFAULT FALSE,

  -- System
  timezone VARCHAR NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 2. HABIT TAXONOMY (seeded / admin-managed)
-- ─────────────────────────────────────────

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  icon VARCHAR,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  goal_prompt TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,

  UNIQUE (category_id, slug)
);

CREATE TABLE starter_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  completion_rule TEXT NOT NULL,
  habit_type VARCHAR NOT NULL CHECK (habit_type IN ('binary_do', 'binary_avoid', 'threshold', 'event_based')),
  default_cadence_options VARCHAR[] NOT NULL,
  cutoff_label VARCHAR,
  threshold_label VARCHAR,
  linked_event VARCHAR,
  is_replacement BOOLEAN NOT NULL DEFAULT FALSE,
  is_two_minute BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);


-- ─────────────────────────────────────────
-- 3. IDENTITY GOALS (Atomic Habits framework)
-- ─────────────────────────────────────────

CREATE TABLE identity_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0
);


-- ─────────────────────────────────────────
-- 4. USER HABITS
-- ─────────────────────────────────────────

CREATE TABLE user_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starter_habit_id UUID REFERENCES starter_habits(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Atomic Habit statement
  name VARCHAR NOT NULL,
  habit_statement TEXT,
  identity_goal_id UUID REFERENCES identity_goals(id) ON DELETE SET NULL,
  trigger VARCHAR,
  location VARCHAR,

  -- Configuration
  habit_type VARCHAR NOT NULL CHECK (habit_type IN ('binary_do', 'binary_avoid', 'threshold', 'event_based')),
  completion_rule TEXT,
  cadence VARCHAR NOT NULL CHECK (cadence IN ('daily', 'weekdays', 'weekends', 'once_a_week', '2_specific_days', '3_specific_days', 'custom')),
  selected_days INT[],
  time_of_day VARCHAR CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
  preferred_time TIME,
  daily_goal INT NOT NULL DEFAULT 1,

  -- Type-specific
  cutoff_value VARCHAR,
  threshold_value VARCHAR,
  linked_event VARCHAR,

  -- Reminder
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_time TIME,

  -- State
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_journaling BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_habits_active ON user_habits(user_id, is_active);


-- ─────────────────────────────────────────
-- 5. HABIT COMPLETIONS
-- ─────────────────────────────────────────

CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_habit_id UUID NOT NULL REFERENCES user_habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_via VARCHAR NOT NULL DEFAULT 'ui' CHECK (completed_via IN ('ui', 'voice')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_habit_id, date)
);


-- ─────────────────────────────────────────
-- 6. DAILY CHECK-IN (mood & wellness)
-- ─────────────────────────────────────────

CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood VARCHAR NOT NULL CHECK (mood IN ('joyful', 'calm', 'okay', 'unhappy', 'awful')),
  energy_level INT CHECK (energy_level BETWEEN 1 AND 5),
  stress_level VARCHAR CHECK (stress_level IN ('low', 'moderate', 'high')),
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 5),
  sleep_hours REAL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, date)
);


-- ─────────────────────────────────────────
-- 7. JOURNAL
-- ─────────────────────────────────────────

CREATE TABLE journal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  icon VARCHAR,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_habit_id UUID REFERENCES user_habits(id) ON DELETE SET NULL,
  category_id UUID REFERENCES journal_categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  prompt VARCHAR,
  response TEXT NOT NULL,
  input_mode VARCHAR NOT NULL DEFAULT 'text' CHECK (input_mode IN ('voice', 'text')),
  time_of_day VARCHAR CHECK (time_of_day IN ('morning', 'evening')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, date);


-- ─────────────────────────────────────────
-- 8. FOCUS SESSIONS
-- ─────────────────────────────────────────

CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_minutes INT NOT NULL,
  actual_minutes INT,
  status VARCHAR NOT NULL CHECK (status IN ('completed', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_focus_sessions_user ON focus_sessions(user_id, started_at);


-- ─────────────────────────────────────────
-- 9. GAMIFICATION
-- ─────────────────────────────────────────

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  icon VARCHAR,
  milestone_type VARCHAR NOT NULL CHECK (milestone_type IN ('streak', 'completions', 'focus', 'journal')),
  required_value INT NOT NULL
);

CREATE TABLE user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  user_habit_id UUID REFERENCES user_habits(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, milestone_id)
);

CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INT NOT NULL,
  reason VARCHAR NOT NULL CHECK (reason IN ('habit_completed', 'streak_milestone', 'focus_completed', 'journal_entry')),
  reference_id UUID,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_points_history ON user_points(user_id, earned_at);


-- ─────────────────────────────────────────
-- 10. ONBOARDING STATE
-- ─────────────────────────────────────────

CREATE TABLE onboarding_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path VARCHAR NOT NULL CHECK (path IN ('keep_it_simple', 'build_my_plan', 'brain_dump')),
  goal_type VARCHAR CHECK (goal_type IN ('stop_completely', 'cut_back')),
  trigger_context VARCHAR CHECK (trigger_context IN ('morning', 'workday', 'evening', 'night', 'weekends', 'specific_days')),
  brain_dump_raw TEXT,
  brain_dump_parsed JSONB,
  current_step INT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 4),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE onboarding_selected_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_state_id UUID NOT NULL REFERENCES onboarding_states(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

  UNIQUE (onboarding_state_id, category_id)
);

CREATE TABLE onboarding_selected_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_state_id UUID NOT NULL REFERENCES onboarding_states(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,

  UNIQUE (onboarding_state_id, subcategory_id)
);


-- ─────────────────────────────────────────
-- 11. NOTIFICATIONS & SETTINGS
-- ─────────────────────────────────────────

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  morning_checkin_reminder TIME DEFAULT '08:00',
  evening_reminder_time TIME DEFAULT '21:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 12. STREAKS & STATS (computed / cached)
-- ─────────────────────────────────────────

CREATE TABLE habit_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_habit_id UUID UNIQUE NOT NULL REFERENCES user_habits(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  total_completions INT NOT NULL DEFAULT 0,
  total_scheduled INT NOT NULL DEFAULT 0,
  completion_rate REAL NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 13. USER TRACKED METRICS (custom numeric metrics)
-- ─────────────────────────────────────────

CREATE TABLE user_tracked_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  input_type VARCHAR NOT NULL DEFAULT 'scale' CHECK (input_type IN ('scale', 'binary', 'numeric', 'text')),
  frequency VARCHAR NOT NULL DEFAULT 'daily',
  scale_min INT,
  scale_max INT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_tracked_metrics_user ON user_tracked_metrics(user_id, is_active);


-- ─────────────────────────────────────────
-- 14. METRIC ENTRIES (logged values)
-- ─────────────────────────────────────────

CREATE TABLE user_metric_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID NOT NULL REFERENCES user_tracked_metrics(id) ON DELETE CASCADE,
  value VARCHAR NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (metric_id, date)
);


-- ─────────────────────────────────────────
-- 15. USER PREFERENCES (app settings)
-- ─────────────────────────────────────────

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_view VARCHAR NOT NULL DEFAULT 'spreadsheet',
  spreadsheet_range VARCHAR NOT NULL DEFAULT 'month',
  reflection_config JSONB DEFAULT '{"fields":[{"id":"gratitude","label":"What are you grateful for?","order":1},{"id":"highlight","label":"Today''s highlight","order":2},{"id":"mood","label":"How do you feel?","order":3}],"show_affirmation":true}',
  affirmation TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 16. AI CONVERSATIONS (logs GPT interactions)
-- ─────────────────────────────────────────

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  model VARCHAR NOT NULL DEFAULT 'gpt-4o-mini',
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  latency_ms INT,
  action_detected VARCHAR,
  confidence REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, created_at);


-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════
-- Supabase requires RLS for all user-facing tables.
-- Users can only access their own data.

-- Enable RLS on all user-data tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_selected_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_selected_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracked_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users table: own row only
CREATE POLICY "users_own_row" ON users
  FOR ALL USING (id = auth.uid());

-- User habits
CREATE POLICY "habits_own" ON user_habits
  FOR ALL USING (user_id = auth.uid());

-- Habit completions (via user_habits join)
CREATE POLICY "completions_own" ON habit_completions
  FOR ALL USING (
    user_habit_id IN (SELECT id FROM user_habits WHERE user_id = auth.uid())
  );

-- Daily check-ins
CREATE POLICY "checkins_own" ON daily_checkins
  FOR ALL USING (user_id = auth.uid());

-- Journal entries
CREATE POLICY "journal_own" ON journal_entries
  FOR ALL USING (user_id = auth.uid());

-- Focus sessions
CREATE POLICY "focus_own" ON focus_sessions
  FOR ALL USING (user_id = auth.uid());

-- User milestones
CREATE POLICY "milestones_own" ON user_milestones
  FOR ALL USING (user_id = auth.uid());

-- User points
CREATE POLICY "points_own" ON user_points
  FOR ALL USING (user_id = auth.uid());

-- Onboarding state
CREATE POLICY "onboarding_own" ON onboarding_states
  FOR ALL USING (user_id = auth.uid());

-- Onboarding selected categories (via onboarding_states join)
CREATE POLICY "onboarding_cats_own" ON onboarding_selected_categories
  FOR ALL USING (
    onboarding_state_id IN (SELECT id FROM onboarding_states WHERE user_id = auth.uid())
  );

-- Onboarding selected subcategories (via onboarding_states join)
CREATE POLICY "onboarding_subs_own" ON onboarding_selected_subcategories
  FOR ALL USING (
    onboarding_state_id IN (SELECT id FROM onboarding_states WHERE user_id = auth.uid())
  );

-- User settings
CREATE POLICY "settings_own" ON user_settings
  FOR ALL USING (user_id = auth.uid());

-- Habit streaks (via user_habits join)
CREATE POLICY "streaks_own" ON habit_streaks
  FOR ALL USING (
    user_habit_id IN (SELECT id FROM user_habits WHERE user_id = auth.uid())
  );

-- User tracked metrics
CREATE POLICY "tracked_metrics_own" ON user_tracked_metrics
  FOR ALL USING (user_id = auth.uid());

-- Metric entries (via user_tracked_metrics join)
CREATE POLICY "metric_entries_own" ON user_metric_entries
  FOR ALL USING (
    metric_id IN (SELECT id FROM user_tracked_metrics WHERE user_id = auth.uid())
  );

-- User preferences
CREATE POLICY "preferences_own" ON user_preferences
  FOR ALL USING (user_id = auth.uid());

-- AI conversations
CREATE POLICY "ai_conversations_own" ON ai_conversations
  FOR ALL USING (user_id = auth.uid());

-- Seeded tables: readable by all authenticated users, writable by admin only
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE starter_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_read" ON categories FOR SELECT USING (TRUE);
CREATE POLICY "subcategories_read" ON subcategories FOR SELECT USING (TRUE);
CREATE POLICY "starter_habits_read" ON starter_habits FOR SELECT USING (TRUE);
CREATE POLICY "identity_goals_read" ON identity_goals FOR SELECT USING (TRUE);
CREATE POLICY "journal_categories_read" ON journal_categories FOR SELECT USING (TRUE);
CREATE POLICY "milestones_read" ON milestones FOR SELECT USING (TRUE);


-- ═══════════════════════════════════════════════════════════════════
-- AUTO-UPDATE TRIGGER (updated_at)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_habits_updated_at
  BEFORE UPDATE ON user_habits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_onboarding_states_updated_at
  BEFORE UPDATE ON onboarding_states FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_habit_streaks_updated_at
  BEFORE UPDATE ON habit_streaks FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- SUPABASE STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════
-- Out-of-database storage for binary files (images, audio, etc.)
-- Managed via Supabase Storage API, not SQL queries.
--
-- Bucket structure:
--   avatars/          → User profile pictures
--     {user_id}/avatar.jpg
--
--   voice-recordings/ → Journal voice input & voice command audio
--     {user_id}/{date}_{entry_id}.webm
--
--   exports/          → Generated images (share streak, milestones)
--     {user_id}/{timestamp}_streak.png
--
-- References in database:
--   users.avatar_url              → avatars/{user_id}/avatar.jpg
--   journal_entries.input_mode    → when 'voice', audio in voice-recordings/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('voice-recordings', 'voice-recordings', FALSE, 10485760, -- 10MB limit
    ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']),
  ('exports', 'exports', TRUE, 5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp']);

-- Storage RLS: users can only manage their own folder

-- Avatars: public read, owner write
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Voice recordings: private, owner only
CREATE POLICY "voice_owner_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'voice-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Exports: public read, owner write
CREATE POLICY "exports_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'exports');

CREATE POLICY "exports_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "exports_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );


-- ═══════════════════════════════════════════════════════════════════
-- ANONYMIZED VIEWS FOR ANALYTICS (MVP-19, #43)
-- ═══════════════════════════════════════════════════════════════════
-- Views expose data with PII hashed for admin analytics.
-- Mood, dates, frequencies, and stats are preserved (not PII).
-- Text fields (names, content, notes) are SHA-256 hashed.

-- Enable pgcrypto for sha256
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Anonymized Habits ───
CREATE OR REPLACE VIEW anonymized_habits AS
SELECT
  id,
  LEFT(encode(digest(user_id::text::bytea, 'sha256'), 'hex'), 16) AS anon_user_id,
  'habit_' || left(encode(digest(name, 'sha256'), 'hex'), 16) AS name,
  habit_type,
  cadence,
  is_active,
  created_at
FROM user_habits;

-- ─── Anonymized Journal Entries ───
CREATE OR REPLACE VIEW anonymized_journal AS
SELECT
  id,
  LEFT(encode(digest(user_id::text::bytea, 'sha256'), 'hex'), 16) AS anon_user_id,
  date,
  'journal_' || left(encode(digest(response, 'sha256'), 'hex'), 16) AS response,
  input_mode,
  time_of_day,
  created_at
FROM journal_entries;

-- ─── Anonymized Daily Check-ins ───
CREATE OR REPLACE VIEW anonymized_checkins AS
SELECT
  id,
  LEFT(encode(digest(user_id::text::bytea, 'sha256'), 'hex'), 16) AS anon_user_id,
  date,
  mood,
  energy_level,
  stress_level,
  sleep_quality,
  sleep_hours,
  CASE WHEN notes IS NOT NULL
    THEN 'note_' || left(encode(digest(notes, 'sha256'), 'hex'), 16)
    ELSE NULL
  END AS notes,
  created_at
FROM daily_checkins;

-- ─── Anonymized Users ───
CREATE OR REPLACE VIEW anonymized_users AS
SELECT
  LEFT(encode(digest(id::text::bytea, 'sha256'), 'hex'), 16) AS anon_user_id,
  'user_' || left(encode(digest(email::bytea, 'sha256'), 'hex'), 16) || '@anon' AS email,
  'anon_' || left(encode(digest(nickname::bytea, 'sha256'), 'hex'), 16) AS nickname,
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
    THEN 'note_' || left(encode(digest(hc.notes, 'sha256'), 'hex'), 16)
    ELSE NULL
  END AS notes,
  hc.created_at
FROM habit_completions hc;

-- ─── Anonymized Onboarding (brain dump hashed) ───
CREATE OR REPLACE VIEW anonymized_onboarding AS
SELECT
  id,
  LEFT(encode(digest(user_id::text::bytea, 'sha256'), 'hex'), 16) AS anon_user_id,
  path,
  goal_type,
  trigger_context,
  CASE WHEN brain_dump_raw IS NOT NULL
    THEN 'braindump_' || left(encode(digest(brain_dump_raw, 'sha256'), 'hex'), 16)
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
  LEFT(encode(digest(user_id::text::bytea, 'sha256'), 'hex'), 16) AS anon_user_id,
  'metric_' || left(encode(digest(name, 'sha256'), 'hex'), 16) AS name,
  input_type,
  frequency,
  scale_min,
  scale_max,
  is_active,
  created_at
FROM user_tracked_metrics;
