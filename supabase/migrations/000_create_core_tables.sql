-- ═══════════════════════════════════════════════════════════════════
-- 000_create_core_tables.sql
-- Core table definitions for Guided Growth MVP
-- Based on schema-erd.md + seed.sql + supabase-data-service.ts
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- Extension
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- 1. users — User profiles & onboarding data
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  auth_provider VARCHAR(50),
  nickname      VARCHAR(100),
  age_group     VARCHAR(20),
  gender        VARCHAR(20),
  language      VARCHAR(10) DEFAULT 'en',
  timezone      VARCHAR(50),
  morning_wakeup_time  TIME,
  night_winddown_time  TIME,
  onboarding_path      VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 2. categories — Habit taxonomy (seeded)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(100) UNIQUE NOT NULL,
  name       VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────
-- 3. subcategories — Habit sub-categories (seeded)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug        VARCHAR(100) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  goal_prompt TEXT
);

-- ─────────────────────────────────────────
-- 4. starter_habits — Pre-defined habit templates (seeded)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS starter_habits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id          UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  name                    VARCHAR(200) NOT NULL,
  habit_type              VARCHAR(50) NOT NULL,
  default_cadence_options VARCHAR(50)[] DEFAULT '{}'
);

-- ─────────────────────────────────────────
-- 5. identity_goals — Atomic Habits identity framework
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- 6. user_habits — User-created habits
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_habits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starter_habit_id UUID REFERENCES starter_habits(id) ON DELETE SET NULL,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  identity_goal_id UUID REFERENCES identity_goals(id) ON DELETE SET NULL,
  name            VARCHAR(200) NOT NULL,
  habit_type      VARCHAR(50) NOT NULL DEFAULT 'binary_do',
  cadence         VARCHAR(50) NOT NULL DEFAULT 'daily',
  daily_goal      INT NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_journaling   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 7. habit_completions — Daily habit check-offs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_habit_id UUID NOT NULL REFERENCES user_habits(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_via VARCHAR(20) DEFAULT 'ui',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_habit_id, date)
);

-- ─────────────────────────────────────────
-- 8. habit_streaks — Computed streaks & stats
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_streaks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_habit_id    UUID NOT NULL UNIQUE REFERENCES user_habits(id) ON DELETE CASCADE,
  current_streak   INT NOT NULL DEFAULT 0,
  longest_streak   INT NOT NULL DEFAULT 0,
  total_completions INT NOT NULL DEFAULT 0,
  total_scheduled  INT NOT NULL DEFAULT 0,
  completion_rate  REAL NOT NULL DEFAULT 0.0
);

-- ─────────────────────────────────────────
-- 9. daily_checkins — Mood & wellness logs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  mood          VARCHAR(50),
  energy_level  INT,
  stress_level  VARCHAR(50),
  sleep_quality INT,
  sleep_hours   NUMERIC(3,1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ─────────────────────────────────────────
-- 10. journal_categories — Journal categories (seeded)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50)
);

-- ─────────────────────────────────────────
-- 11. journal_entries — User journal entries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_habit_id UUID REFERENCES user_habits(id) ON DELETE SET NULL,
  category_id   UUID REFERENCES journal_categories(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  response      TEXT NOT NULL,
  prompt        TEXT,
  input_mode    VARCHAR(20) DEFAULT 'text',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 12. focus_sessions — Pomodoro-style sessions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS focus_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_minutes INT NOT NULL,
  actual_minutes   INT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 13. milestones — Milestone definitions (seeded)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200) NOT NULL,
  milestone_type VARCHAR(50) NOT NULL,
  required_value INT NOT NULL
);

-- ─────────────────────────────────────────
-- 14. user_milestones — User milestone achievements
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  earned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 15. user_points — Gamification points ledger
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_points (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points    INT NOT NULL,
  reason    VARCHAR(200),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 16. onboarding_states — Onboarding progress
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_states (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  path             VARCHAR(50),
  current_step     INT NOT NULL DEFAULT 0,
  brain_dump_raw   TEXT,
  brain_dump_parsed JSONB
);

-- ─────────────────────────────────────────
-- 17. onboarding_selected_categories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_selected_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_state_id UUID NOT NULL REFERENCES onboarding_states(id) ON DELETE CASCADE,
  category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 18. onboarding_selected_subcategories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_selected_subcategories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_state_id UUID NOT NULL REFERENCES onboarding_states(id) ON DELETE CASCADE,
  subcategory_id      UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 19. user_settings — Notification preferences
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notification_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  morning_checkin_reminder TIME,
  evening_reminder_time    TIME
);

-- ─────────────────────────────────────────
-- 20. metrics — Custom tracked metrics
-- Used by SupabaseDataService for user-defined metrics
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  input_type  VARCHAR(20) NOT NULL DEFAULT 'scale',
  frequency   VARCHAR(50) NOT NULL DEFAULT 'daily',
  scale_min   INT,
  scale_max   INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 21. metric_entries — Logged values for metrics
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metric_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id  UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  value      TEXT NOT NULL,
  date       DATE NOT NULL,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric_id, date)
);

-- ─────────────────────────────────────────
-- 22. user_preferences — User preference settings
-- Referenced by migration 001
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme   VARCHAR(20) DEFAULT 'system',
  locale  VARCHAR(10) DEFAULT 'en'
);

-- ─────────────────────────────────────────
-- 23. tasks — User tasks with priority and recurrence
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority     VARCHAR(10) DEFAULT 'medium',
  due_date     DATE,
  recurrence   VARCHAR(50),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 24. ai_conversations — Voice/AI interaction history
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL,
  content    TEXT NOT NULL,
  model      VARCHAR(50),
  tokens     INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- Indexes for common queries
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_habits_user_id ON user_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_habits_active ON user_habits(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON habit_completions(user_habit_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_milestones_user ON user_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metric_entries_metric_date ON metric_entries(metric_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
