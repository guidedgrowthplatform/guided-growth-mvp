-- ═══════════════════════════════════════════════════════════════════
-- 001_onboarding.sql
-- Onboarding state tracking, categories, habits, and related tables
-- Depends on: 000_better_auth_tables.sql ("user" table)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. onboarding_states — Tracks onboarding progress per user
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_states (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  path             VARCHAR(20),
  current_step     INT NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'not_started',
  data             JSONB NOT NULL DEFAULT '{}'::jsonb,
  brain_dump_raw   TEXT,
  brain_dump_parsed JSONB,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_status
  ON onboarding_states(user_id, status);

-- ─────────────────────────────────────────
-- 2. categories — Habit taxonomy
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(100) UNIQUE NOT NULL,
  name       VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────
-- 3. subcategories — Goals within categories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug        VARCHAR(100) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  goal_prompt TEXT,
  UNIQUE (category_id, slug)
);

-- ─────────────────────────────────────────
-- 4. starter_habits — Pre-defined habit templates
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS starter_habits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id          UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  name                    VARCHAR(200) NOT NULL,
  habit_type              VARCHAR(50) NOT NULL,
  default_cadence_options VARCHAR(50)[] DEFAULT '{}'
);

-- ─────────────────────────────────────────
-- 5. user_habits — Habits created by users (during onboarding or later)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_habits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  starter_habit_id UUID REFERENCES starter_habits(id) ON DELETE SET NULL,
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  name             VARCHAR(200) NOT NULL,
  habit_type       VARCHAR(50) NOT NULL DEFAULT 'binary_do',
  cadence          VARCHAR(50) NOT NULL DEFAULT 'daily',
  schedule_days    INT[],
  reminder_time    TIME,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INT NOT NULL DEFAULT 0,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_habits_user_id ON user_habits(user_id);

-- ─────────────────────────────────────────
-- 6. onboarding_selected_categories — Beginner path step 3
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_selected_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_state_id UUID NOT NULL REFERENCES onboarding_states(id) ON DELETE CASCADE,
  category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE (onboarding_state_id, category_id)
);

-- ─────────────────────────────────────────
-- 7. onboarding_selected_subcategories — Beginner path step 4
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_selected_subcategories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_state_id UUID NOT NULL REFERENCES onboarding_states(id) ON DELETE CASCADE,
  subcategory_id      UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  UNIQUE (onboarding_state_id, subcategory_id)
);
