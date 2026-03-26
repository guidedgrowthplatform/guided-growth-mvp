-- ═══════════════════════════════════════════════════════════════════
-- 007_full_schema_sync.sql
-- Comprehensive schema sync: adds all tables and columns that exist
-- in the production DB / API code but are missing from migrations.
-- Safe to run on both fresh and existing databases (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. Add missing columns to users table
-- API code (admin/[...path].ts) references: role, status, name, avatar_url, last_login_at
-- ─────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Enforce valid values
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- 2. Add missing columns to metrics table
-- API code references: sort_order, question, active
-- ─────────────────────────────────────────
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- ─────────────────────────────────────────
-- 3. Add missing column to user_preferences
-- API code (preferences.ts) references: default_view
-- ─────────────────────────────────────────
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS default_view VARCHAR(20) NOT NULL DEFAULT 'spreadsheet';

-- ─────────────────────────────────────────
-- 4. Create 'entries' table (referenced by api/entries/[...path].ts)
-- This is a simplified metric entries table with user_id for direct access
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  metric_id  TEXT NOT NULL,
  date       DATE NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric_id, date)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_metric ON entries(metric_id);

-- ─────────────────────────────────────────
-- 5. Create 'reflections' table (referenced by api/reflections/[...path].ts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  date       DATE NOT NULL,
  field_id   VARCHAR(100) NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, field_id)
);

CREATE INDEX IF NOT EXISTS idx_reflections_user_date ON reflections(user_id, date);

-- ─────────────────────────────────────────
-- 6. Create 'reflection_configs' table (referenced by api/reflections/[...path].ts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflection_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL UNIQUE,
  fields            JSONB NOT NULL DEFAULT '[]'::jsonb,
  show_affirmation  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 7. Create 'admin_audit_log' table (referenced by api/admin/[...path].ts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id     TEXT NOT NULL,
  action            VARCHAR(100) NOT NULL,
  target_type       VARCHAR(100) NOT NULL,
  target_identifier TEXT,
  payload_json      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);

-- ─────────────────────────────────────────
-- 8. Create 'allowlist' table (referenced by api/admin/[...path].ts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allowlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL UNIQUE,
  added_by_user_id TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 9. Fix Better Auth tables: TIMESTAMP -> TIMESTAMPTZ
-- Prevents timezone ambiguity on session expiry
-- ─────────────────────────────────────────
DO $$ BEGIN
  -- "user" table
  ALTER TABLE "user" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';
  ALTER TABLE "user" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  -- "session" table
  ALTER TABLE "session" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ USING "expiresAt" AT TIME ZONE 'UTC';
  ALTER TABLE "session" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';
  ALTER TABLE "session" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  -- "account" table
  ALTER TABLE "account" ALTER COLUMN "accessTokenExpiresAt" TYPE TIMESTAMPTZ USING "accessTokenExpiresAt" AT TIME ZONE 'UTC';
  ALTER TABLE "account" ALTER COLUMN "refreshTokenExpiresAt" TYPE TIMESTAMPTZ USING "refreshTokenExpiresAt" AT TIME ZONE 'UTC';
  ALTER TABLE "account" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';
  ALTER TABLE "account" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  -- "verification" table
  ALTER TABLE "verification" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ USING "expiresAt" AT TIME ZONE 'UTC';
  ALTER TABLE "verification" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';
  ALTER TABLE "verification" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- 10. Add missing FK indexes (unindexed FKs cause slow CASCADE deletes)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_identity_goals_category ON identity_goals(category_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sel_cat_state ON onboarding_selected_categories(onboarding_state_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sel_cat_cat ON onboarding_selected_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sel_sub_state ON onboarding_selected_subcategories(onboarding_state_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sel_sub_sub ON onboarding_selected_subcategories(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_user_milestones_milestone ON user_milestones(milestone_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_habit ON journal_entries(user_habit_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_category ON journal_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_metrics_sort ON metrics(user_id, sort_order);

-- ─────────────────────────────────────────
-- 11. Enable RLS on new tables + add policies
-- Note: These use service_role bypass since Better Auth doesn't
-- provide auth.uid(). API layer enforces user_id = $1 in all queries.
-- ─────────────────────────────────────────
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowlist ENABLE ROW LEVEL SECURITY;

-- Service role (used by API) bypasses RLS by default.
-- No anon/authenticated policies needed since all access goes through
-- the Vercel API layer which uses the service role connection.

-- ─────────────────────────────────────────
-- 12. Add CHECK constraints for data integrity
-- ─────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE daily_checkins ADD CONSTRAINT chk_energy_level CHECK (energy_level BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE daily_checkins ADD CONSTRAINT chk_sleep_quality CHECK (sleep_quality BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE daily_checkins ADD CONSTRAINT chk_sleep_hours CHECK (sleep_hours BETWEEN 0 AND 24);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_habits ADD CONSTRAINT chk_habit_cadence CHECK (cadence IN ('daily', 'weekdays', 'weekends', 'weekly', '3x/week', '2x/week', '1x/week', '3_specific_days', 'once_a_week', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
