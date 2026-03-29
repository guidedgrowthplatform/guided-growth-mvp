-- App feature tables
-- All user_id columns reference "user"(id) TEXT with ON DELETE CASCADE

-- User app preferences (settings, not identity)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  coaching_style VARCHAR(50) DEFAULT 'friendly',
  voice_model VARCHAR(50) DEFAULT 'default',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50),
  morning_time TIME DEFAULT '08:00',
  night_time TIME DEFAULT '21:00',
  push_notifications BOOLEAN DEFAULT true,
  preferences_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habit completions (user_id denormalized for RLS + query performance)
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES user_habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

-- Metrics (moved from localStorage)
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input_type VARCHAR(20) NOT NULL DEFAULT 'numeric',  -- scale | binary | numeric | text
  scale_min INT,
  scale_max INT,
  unit TEXT,
  target_value NUMERIC,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metric entries (one value per metric per date)
CREATE TABLE metric_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value TEXT NOT NULL,  -- TEXT supports all input types: scale/binary/numeric/text
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric_id, date)
);

-- Daily check-ins (all 4 dimensions as SMALLINT 1-5, no string mapping in DB)
CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood SMALLINT CHECK (mood BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  stress SMALLINT CHECK (stress BETWEEN 1 AND 5),
  sleep SMALLINT CHECK (sleep BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Journal entries (content is client-side encrypted before storage)
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  themes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reflection config (per user, created at end of onboarding)
CREATE TABLE reflection_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  schedule VARCHAR(20) DEFAULT 'Weekday',   -- Weekday | Weekend | Every day
  schedule_days INT[],
  reminder_time TIME DEFAULT '21:45',
  reminder_enabled BOOLEAN DEFAULT true,
  custom_prompts TEXT[],   -- NULL = use default prompts
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reflections (one per user per date)
CREATE TABLE reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',   -- { "prompt text": "answer", ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Focus sessions
CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES user_habits(id) ON DELETE SET NULL,
  duration_minutes INT NOT NULL,
  actual_minutes INT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ
);

-- Admin audit log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL REFERENCES "user"(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_identifier TEXT,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_habit_completions_user_date ON habit_completions(user_id, date);
CREATE INDEX idx_habit_completions_habit_date ON habit_completions(habit_id, date);
CREATE INDEX idx_metric_entries_user_date ON metric_entries(user_id, date);
CREATE INDEX idx_metric_entries_metric_date ON metric_entries(metric_id, date);
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, created_at DESC);
CREATE INDEX idx_reflections_user_date ON reflections(user_id, date);
CREATE INDEX idx_daily_checkins_user_date ON daily_checkins(user_id, date);
CREATE INDEX idx_focus_sessions_user_started ON focus_sessions(user_id, started_at DESC);
