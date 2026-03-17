-- =====================================================================
-- Guided Growth — Migration 002: API Tables
-- ---------------------------------------------------------------------
-- Creates the tables that the API endpoints actually query.
-- 001_full_schema.sql defines the "ideal" domain model, but the API
-- code uses simpler, flatter table names (metrics, entries, reflections,
-- etc.).  This migration bridges the gap.
--
-- Safety: uses CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS
-- so the migration is idempotent.
--
-- RLS: all policies use (SELECT auth.uid()) — NOT bare auth.uid() —
-- for query-planner performance (prevents per-row re-evaluation).
-- =====================================================================


-- ─────────────────────────────────────────
-- 0. ALTER existing tables from 001
-- ─────────────────────────────────────────

-- Add columns the API expects on the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add CHECK constraints for role and status (safe: wrapped in DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check
      CHECK (status IN ('active', 'disabled'));
  END IF;
END $$;

-- Pending migration from CLAUDE.md: spreadsheet_range on user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS spreadsheet_range VARCHAR(10) DEFAULT 'month';


-- ─────────────────────────────────────────
-- 1. metrics  (api/metrics/[...path].ts)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metrics (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  input_type  TEXT          DEFAULT 'binary',
  question    TEXT          DEFAULT '',
  active      BOOLEAN       DEFAULT true,
  frequency   TEXT          DEFAULT 'daily',
  sort_order  INT           DEFAULT 0,
  target_value NUMERIC      NULL,
  target_unit  TEXT         NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id);

-- Pending migrations from CLAUDE.md (already in CREATE TABLE above,
-- but safe to run for existing tables):
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS target_value NUMERIC NULL;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS target_unit VARCHAR(20) NULL;


-- ─────────────────────────────────────────
-- 2. entries  (api/entries/[...path].ts)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entries (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_id   UUID          NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  date        DATE          NOT NULL,
  value       TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),

  UNIQUE (user_id, metric_id, date)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);


-- ─────────────────────────────────────────
-- 3. reflections  (api/reflections/[...path].ts)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reflections (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE          NOT NULL,
  field_id    TEXT          NOT NULL,
  value       TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),

  UNIQUE (user_id, date, field_id)
);


-- ─────────────────────────────────────────
-- 4. reflection_configs  (api/reflections/[...path].ts config route)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reflection_configs (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID      UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fields            JSONB     NOT NULL,
  show_affirmation  BOOLEAN   DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 5. affirmations  (api/affirmation.ts)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS affirmations (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value       TEXT          NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 6. allowlist  (api/auth/[...path].ts, api/admin/[...path].ts)
-- ─────────────────────────────────────────
-- NO RLS — admin-only access enforced by API middleware.

CREATE TABLE IF NOT EXISTS allowlist (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT      UNIQUE NOT NULL,
  added_by_user_id  UUID      REFERENCES users(id) ON DELETE SET NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────
-- 7. admin_audit_log  (api/admin/[...path].ts)
-- ─────────────────────────────────────────
-- NO RLS — admin-only access enforced by API middleware.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id     UUID      REFERENCES users(id) ON DELETE SET NULL,
  action            TEXT      NOT NULL,
  target_type       TEXT      NOT NULL,
  target_identifier TEXT,
  payload_json      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log(created_at DESC);


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- Enable RLS on user-facing tables
ALTER TABLE metrics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE affirmations      ENABLE ROW LEVEL SECURITY;

-- metrics: users see only their own rows
CREATE POLICY "metrics_own" ON metrics
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- entries: users see only their own rows
CREATE POLICY "entries_own" ON entries
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- reflections: users see only their own rows
CREATE POLICY "reflections_own" ON reflections
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- reflection_configs: users see only their own row
CREATE POLICY "reflection_configs_own" ON reflection_configs
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- affirmations: users see only their own row
CREATE POLICY "affirmations_own" ON affirmations
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- allowlist and admin_audit_log intentionally have NO RLS.
-- Access is gated by API middleware (admin role check).


-- =====================================================================
-- AUTO-UPDATE TRIGGER (updated_at) for metrics
-- =====================================================================
-- Reuses update_updated_at() function from 001_full_schema.sql.

CREATE TRIGGER trg_metrics_updated_at
  BEFORE UPDATE ON metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
