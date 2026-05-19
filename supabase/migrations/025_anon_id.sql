-- P1-21: Anonymization MVP.
-- Splits identity (profiles.id ↔ auth.users.id) from behavior (anon_id FKs on
-- every user-keyed table). profiles.anon_id is locked to service_role for
-- direct SELECT; authenticated users access only their own anon_id via the
-- SECURITY DEFINER helper current_anon_id().
--
-- Tables switched (15 total):
--   Behavioral: session_log, user_habits, habit_completions, daily_checkins,
--               journal_entries, reflections, metrics, metric_entries,
--               entries, focus_sessions, feedback
--   Config:     user_preferences, reflection_configs, affirmations
--   Onboarding: onboarding_states
--
-- Notes:
--   • journal_entry_fields RLS rewritten to join via journal_entries.anon_id.
--   • onboarding_selected_(categories|subcategories) RLS rewritten to join
--     via onboarding_states.anon_id.
--   • prune_session_log() rewritten to PARTITION BY anon_id.
--   • session_log + feedback retain "RLS on, no policy" posture (service-role
--     only); only column + index swap.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.anon_id — the bridge column
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN anon_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- SECURITY DEFINER helper: returns the caller's anon_id without exposing the
-- column. Used by every behavioral-table RLS policy below.
CREATE OR REPLACE FUNCTION public.current_anon_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT anon_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_anon_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_anon_id() TO authenticated, service_role;
ALTER FUNCTION public.current_anon_id() OWNER TO postgres;

-- Lock the anon_id column: authenticated users cannot SELECT it directly,
-- only via current_anon_id(). service_role keeps full access.
REVOKE SELECT (anon_id) ON profiles FROM authenticated, anon;
GRANT SELECT (anon_id) ON profiles TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Per-table swap. Pattern (per table):
--    a) DROP existing user_isolation policy (if any)
--    b) ADD anon_id UUID NULL
--    c) Backfill from profiles
--    d) SET anon_id NOT NULL + add FK to profiles(anon_id) ON DELETE CASCADE
--    e) DROP UNIQUE constraints / indexes that reference user_id
--    f) DROP COLUMN user_id
--    g) Recreate UNIQUE constraints and indexes on anon_id
--    h) Recreate user_isolation policy using current_anon_id()
-- ─────────────────────────────────────────────────────────────────────────

-- ── onboarding_states ───────────────────────────────────────────────────
-- Child policies join onto user_id; drop first so the column drop succeeds.
DROP POLICY IF EXISTS "user_isolation" ON onboarding_selected_categories;
DROP POLICY IF EXISTS "user_isolation" ON onboarding_selected_subcategories;
DROP POLICY IF EXISTS "user_isolation" ON onboarding_states;
ALTER TABLE onboarding_states ADD COLUMN anon_id UUID;
UPDATE onboarding_states t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE onboarding_states ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE onboarding_states ADD CONSTRAINT onboarding_states_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE onboarding_states ADD CONSTRAINT onboarding_states_anon_id_key UNIQUE (anon_id);
ALTER TABLE onboarding_states DROP CONSTRAINT onboarding_states_user_id_key;
DROP INDEX IF EXISTS idx_onboarding_user_status;
ALTER TABLE onboarding_states DROP COLUMN user_id;
CREATE INDEX idx_onboarding_anon_status ON onboarding_states(anon_id, status);
CREATE POLICY "user_isolation" ON onboarding_states
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── user_habits ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON user_habits;
ALTER TABLE user_habits ADD COLUMN anon_id UUID;
UPDATE user_habits t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE user_habits ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE user_habits ADD CONSTRAINT user_habits_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE user_habits DROP CONSTRAINT user_habits_user_id_name_key;
DROP INDEX IF EXISTS idx_user_habits_user_id;
ALTER TABLE user_habits DROP COLUMN user_id;
ALTER TABLE user_habits ADD CONSTRAINT user_habits_anon_name_key UNIQUE (anon_id, name);
CREATE INDEX idx_user_habits_anon_id ON user_habits(anon_id);
CREATE POLICY "user_isolation" ON user_habits
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── user_preferences ────────────────────────────────────────────────────
-- Drift: legacy dashboard-created policy also references user_id.
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "user_isolation" ON user_preferences;
ALTER TABLE user_preferences ADD COLUMN anon_id UUID;
UPDATE user_preferences t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE user_preferences ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE user_preferences DROP CONSTRAINT user_preferences_user_id_key;
ALTER TABLE user_preferences DROP COLUMN user_id;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_anon_id_key UNIQUE (anon_id);
CREATE POLICY "user_isolation" ON user_preferences
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── habit_completions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON habit_completions;
ALTER TABLE habit_completions ADD COLUMN anon_id UUID;
UPDATE habit_completions t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE habit_completions ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE habit_completions ADD CONSTRAINT habit_completions_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_habit_completions_user_date;
ALTER TABLE habit_completions DROP COLUMN user_id;
CREATE INDEX idx_habit_completions_anon_date ON habit_completions(anon_id, date);
CREATE POLICY "user_isolation" ON habit_completions
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── metrics ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON metrics;
ALTER TABLE metrics ADD COLUMN anon_id UUID;
UPDATE metrics t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE metrics ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE metrics ADD CONSTRAINT metrics_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE metrics DROP COLUMN user_id;
CREATE INDEX idx_metrics_anon_id ON metrics(anon_id);
CREATE POLICY "user_isolation" ON metrics
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── metric_entries ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON metric_entries;
ALTER TABLE metric_entries ADD COLUMN anon_id UUID;
UPDATE metric_entries t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE metric_entries ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE metric_entries ADD CONSTRAINT metric_entries_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_metric_entries_user_date;
ALTER TABLE metric_entries DROP COLUMN user_id;
CREATE INDEX idx_metric_entries_anon_date ON metric_entries(anon_id, date);
CREATE POLICY "user_isolation" ON metric_entries
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── daily_checkins ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON daily_checkins;
ALTER TABLE daily_checkins ADD COLUMN anon_id UUID;
UPDATE daily_checkins t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE daily_checkins ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE daily_checkins DROP CONSTRAINT daily_checkins_user_id_date_key;
DROP INDEX IF EXISTS idx_daily_checkins_user_date;
ALTER TABLE daily_checkins DROP COLUMN user_id;
ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_anon_date_key UNIQUE (anon_id, date);
CREATE INDEX idx_daily_checkins_anon_date ON daily_checkins(anon_id, date);
CREATE POLICY "user_isolation" ON daily_checkins
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── journal_entries (006 schema: parent only, content in journal_entry_fields) ──
DROP POLICY IF EXISTS "user_isolation" ON journal_entries;
DROP POLICY IF EXISTS "user_isolation" ON journal_entry_fields;
ALTER TABLE journal_entries ADD COLUMN anon_id UUID;
UPDATE journal_entries t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE journal_entries ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_journal_entries_user_date;
ALTER TABLE journal_entries DROP COLUMN user_id;
CREATE INDEX idx_journal_entries_anon_date ON journal_entries(anon_id, date DESC);
CREATE POLICY "user_isolation" ON journal_entries
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());
CREATE POLICY "user_isolation" ON journal_entry_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_fields.entry_id
        AND je.anon_id = current_anon_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_fields.entry_id
        AND je.anon_id = current_anon_id()
    )
  );

-- ── reflection_configs ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON reflection_configs;
ALTER TABLE reflection_configs ADD COLUMN anon_id UUID;
UPDATE reflection_configs t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE reflection_configs ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE reflection_configs ADD CONSTRAINT reflection_configs_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE reflection_configs DROP CONSTRAINT reflection_configs_user_id_key;
ALTER TABLE reflection_configs DROP COLUMN user_id;
ALTER TABLE reflection_configs ADD CONSTRAINT reflection_configs_anon_id_key UNIQUE (anon_id);
CREATE POLICY "user_isolation" ON reflection_configs
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── reflections ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON reflections;
ALTER TABLE reflections ADD COLUMN anon_id UUID;
UPDATE reflections t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE reflections ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE reflections ADD CONSTRAINT reflections_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE reflections DROP CONSTRAINT reflections_user_id_date_field_id_key;
DROP INDEX IF EXISTS idx_reflections_user_date;
ALTER TABLE reflections DROP COLUMN user_id;
ALTER TABLE reflections ADD CONSTRAINT reflections_anon_date_field_key UNIQUE (anon_id, date, field_id);
CREATE INDEX idx_reflections_anon_date ON reflections(anon_id, date);
CREATE POLICY "user_isolation" ON reflections
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── focus_sessions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON focus_sessions;
ALTER TABLE focus_sessions ADD COLUMN anon_id UUID;
UPDATE focus_sessions t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE focus_sessions ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE focus_sessions ADD CONSTRAINT focus_sessions_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_focus_sessions_user_started;
ALTER TABLE focus_sessions DROP COLUMN user_id;
CREATE INDEX idx_focus_sessions_anon_started ON focus_sessions(anon_id, started_at DESC);
CREATE POLICY "user_isolation" ON focus_sessions
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── entries ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON entries;
ALTER TABLE entries ADD COLUMN anon_id UUID;
UPDATE entries t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE entries ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE entries ADD CONSTRAINT entries_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE entries DROP CONSTRAINT entries_user_id_metric_id_date_key;
DROP INDEX IF EXISTS idx_entries_user_date;
ALTER TABLE entries DROP COLUMN user_id;
ALTER TABLE entries ADD CONSTRAINT entries_anon_metric_date_key UNIQUE (anon_id, metric_id, date);
CREATE INDEX idx_entries_anon_date ON entries(anon_id, date);
CREATE POLICY "user_isolation" ON entries
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── affirmations ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON affirmations;
ALTER TABLE affirmations ADD COLUMN anon_id UUID;
UPDATE affirmations t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE affirmations ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE affirmations ADD CONSTRAINT affirmations_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
ALTER TABLE affirmations DROP CONSTRAINT affirmations_user_id_key;
ALTER TABLE affirmations DROP COLUMN user_id;
ALTER TABLE affirmations ADD CONSTRAINT affirmations_anon_id_key UNIQUE (anon_id);
CREATE POLICY "user_isolation" ON affirmations
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());

-- ── feedback (RLS enabled, no policy — service-role only; column swap only) ──
ALTER TABLE feedback ADD COLUMN anon_id UUID;
UPDATE feedback t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE feedback ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE feedback ADD CONSTRAINT feedback_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_feedback_user;
ALTER TABLE feedback DROP COLUMN user_id;
CREATE INDEX idx_feedback_anon ON feedback(anon_id, created_at DESC);

-- ── session_log (RLS enabled, no policy — service-role only) ────────────
ALTER TABLE session_log ADD COLUMN anon_id UUID;
UPDATE session_log t SET anon_id = p.anon_id FROM profiles p WHERE p.id = t.user_id;
ALTER TABLE session_log ALTER COLUMN anon_id SET NOT NULL;
ALTER TABLE session_log ADD CONSTRAINT session_log_anon_fk
  FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE;
DROP INDEX IF EXISTS session_log_user_time_idx;
ALTER TABLE session_log DROP COLUMN user_id;
CREATE INDEX session_log_anon_time_idx ON session_log(anon_id, timestamp DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. onboarding_selected_(categories|subcategories) — RLS join rewrite
--    (Tables themselves only reference onboarding_state_id; no user_id col,
--     so no column swap needed. Just rewrite the policy to use anon_id via
--     the parent table.)
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_isolation" ON onboarding_selected_categories;
CREATE POLICY "user_isolation" ON onboarding_selected_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND anon_id = current_anon_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND anon_id = current_anon_id()
    )
  );

DROP POLICY IF EXISTS "user_isolation" ON onboarding_selected_subcategories;
CREATE POLICY "user_isolation" ON onboarding_selected_subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND anon_id = current_anon_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND anon_id = current_anon_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Rewrite prune_session_log() — was PARTITION BY user_id.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prune_session_log()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  deleted_count INT;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY anon_id ORDER BY timestamp DESC) AS rn
    FROM public.session_log
  )
  DELETE FROM public.session_log
  WHERE id IN (
    SELECT id FROM ranked WHERE rn > 20
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'prune_session_log deleted % row(s)', deleted_count;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_session_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_session_log() TO postgres, service_role;
ALTER FUNCTION public.prune_session_log() OWNER TO postgres;

COMMIT;
