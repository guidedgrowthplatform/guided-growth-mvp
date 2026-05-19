-- P1-21 down: reverse 025_anon_id.sql.
-- Restores user_id columns, FKs, original UNIQUE constraints, original
-- indexes, and the pre-025 auth.uid()-based RLS policies. Drops the
-- current_anon_id() helper and profiles.anon_id last (after all FKs gone).
-- Recovery-plan only — not expected to run in prod.
--
-- Divergence from original schema: FKs restored to profiles(id), not
-- auth.users(id). Chain still works (profiles.id → auth.users.id CASCADE),
-- but a direct DELETE on profiles cascades to behavior tables (in the
-- original, only auth.users deletes cascaded).

BEGIN;

-- ── session_log ─────────────────────────────────────────────────────────
ALTER TABLE session_log ADD COLUMN user_id UUID;
UPDATE session_log t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE session_log ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE session_log ADD CONSTRAINT session_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS session_log_anon_time_idx;
ALTER TABLE session_log DROP CONSTRAINT session_log_anon_fk;
ALTER TABLE session_log DROP COLUMN anon_id;
CREATE INDEX session_log_user_time_idx ON session_log(user_id, timestamp DESC);

-- ── feedback ────────────────────────────────────────────────────────────
ALTER TABLE feedback ADD COLUMN user_id UUID;
UPDATE feedback t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE feedback ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE feedback ADD CONSTRAINT feedback_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_feedback_anon;
ALTER TABLE feedback DROP CONSTRAINT feedback_anon_fk;
ALTER TABLE feedback DROP COLUMN anon_id;
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at DESC);

-- ── affirmations ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON affirmations;
ALTER TABLE affirmations ADD COLUMN user_id UUID;
UPDATE affirmations t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE affirmations ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE affirmations ADD CONSTRAINT affirmations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE affirmations DROP CONSTRAINT affirmations_anon_id_key;
ALTER TABLE affirmations DROP CONSTRAINT affirmations_anon_fk;
ALTER TABLE affirmations DROP COLUMN anon_id;
ALTER TABLE affirmations ADD CONSTRAINT affirmations_user_id_key UNIQUE (user_id);
CREATE POLICY "user_isolation" ON affirmations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── entries ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON entries;
ALTER TABLE entries ADD COLUMN user_id UUID;
UPDATE entries t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE entries ADD CONSTRAINT entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE entries DROP CONSTRAINT entries_anon_metric_date_key;
DROP INDEX IF EXISTS idx_entries_anon_date;
ALTER TABLE entries DROP CONSTRAINT entries_anon_fk;
ALTER TABLE entries DROP COLUMN anon_id;
ALTER TABLE entries ADD CONSTRAINT entries_user_id_metric_id_date_key UNIQUE (user_id, metric_id, date);
CREATE INDEX idx_entries_user_date ON entries(user_id, date);
CREATE POLICY "user_isolation" ON entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── focus_sessions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON focus_sessions;
ALTER TABLE focus_sessions ADD COLUMN user_id UUID;
UPDATE focus_sessions t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE focus_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE focus_sessions ADD CONSTRAINT focus_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_focus_sessions_anon_started;
ALTER TABLE focus_sessions DROP CONSTRAINT focus_sessions_anon_fk;
ALTER TABLE focus_sessions DROP COLUMN anon_id;
CREATE INDEX idx_focus_sessions_user_started ON focus_sessions(user_id, started_at DESC);
CREATE POLICY "user_isolation" ON focus_sessions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── reflections ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON reflections;
ALTER TABLE reflections ADD COLUMN user_id UUID;
UPDATE reflections t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE reflections ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE reflections ADD CONSTRAINT reflections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE reflections DROP CONSTRAINT reflections_anon_date_field_key;
DROP INDEX IF EXISTS idx_reflections_anon_date;
ALTER TABLE reflections DROP CONSTRAINT reflections_anon_fk;
ALTER TABLE reflections DROP COLUMN anon_id;
ALTER TABLE reflections ADD CONSTRAINT reflections_user_id_date_field_id_key UNIQUE (user_id, date, field_id);
CREATE INDEX idx_reflections_user_date ON reflections(user_id, date);
CREATE POLICY "user_isolation" ON reflections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── reflection_configs ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON reflection_configs;
ALTER TABLE reflection_configs ADD COLUMN user_id UUID;
UPDATE reflection_configs t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE reflection_configs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE reflection_configs ADD CONSTRAINT reflection_configs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE reflection_configs DROP CONSTRAINT reflection_configs_anon_id_key;
ALTER TABLE reflection_configs DROP CONSTRAINT reflection_configs_anon_fk;
ALTER TABLE reflection_configs DROP COLUMN anon_id;
ALTER TABLE reflection_configs ADD CONSTRAINT reflection_configs_user_id_key UNIQUE (user_id);
CREATE POLICY "user_isolation" ON reflection_configs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── journal_entries + journal_entry_fields ──────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON journal_entry_fields;
DROP POLICY IF EXISTS "user_isolation" ON journal_entries;
ALTER TABLE journal_entries ADD COLUMN user_id UUID;
UPDATE journal_entries t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE journal_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_journal_entries_anon_date;
ALTER TABLE journal_entries DROP CONSTRAINT journal_entries_anon_fk;
ALTER TABLE journal_entries DROP COLUMN anon_id;
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, date DESC);
CREATE POLICY "user_isolation" ON journal_entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolation" ON journal_entry_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_fields.entry_id
        AND je.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_fields.entry_id
        AND je.user_id = auth.uid()
    )
  );

-- ── daily_checkins ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON daily_checkins;
ALTER TABLE daily_checkins ADD COLUMN user_id UUID;
UPDATE daily_checkins t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE daily_checkins ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE daily_checkins DROP CONSTRAINT daily_checkins_anon_date_key;
DROP INDEX IF EXISTS idx_daily_checkins_anon_date;
ALTER TABLE daily_checkins DROP CONSTRAINT daily_checkins_anon_fk;
ALTER TABLE daily_checkins DROP COLUMN anon_id;
ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_user_id_date_key UNIQUE (user_id, date);
CREATE INDEX idx_daily_checkins_user_date ON daily_checkins(user_id, date);
CREATE POLICY "user_isolation" ON daily_checkins
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── metric_entries ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON metric_entries;
ALTER TABLE metric_entries ADD COLUMN user_id UUID;
UPDATE metric_entries t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE metric_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE metric_entries ADD CONSTRAINT metric_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_metric_entries_anon_date;
ALTER TABLE metric_entries DROP CONSTRAINT metric_entries_anon_fk;
ALTER TABLE metric_entries DROP COLUMN anon_id;
CREATE INDEX idx_metric_entries_user_date ON metric_entries(user_id, date);
CREATE POLICY "user_isolation" ON metric_entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── metrics ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON metrics;
ALTER TABLE metrics ADD COLUMN user_id UUID;
UPDATE metrics t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE metrics ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE metrics ADD CONSTRAINT metrics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_metrics_anon_id;
ALTER TABLE metrics DROP CONSTRAINT metrics_anon_fk;
ALTER TABLE metrics DROP COLUMN anon_id;
-- No original user_id index on metrics (002_app_tables.sql only had FK).
CREATE POLICY "user_isolation" ON metrics
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── habit_completions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON habit_completions;
ALTER TABLE habit_completions ADD COLUMN user_id UUID;
UPDATE habit_completions t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE habit_completions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE habit_completions ADD CONSTRAINT habit_completions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS idx_habit_completions_anon_date;
ALTER TABLE habit_completions DROP CONSTRAINT habit_completions_anon_fk;
ALTER TABLE habit_completions DROP COLUMN anon_id;
CREATE INDEX idx_habit_completions_user_date ON habit_completions(user_id, date);
CREATE POLICY "user_isolation" ON habit_completions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── user_preferences ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON user_preferences;
ALTER TABLE user_preferences ADD COLUMN user_id UUID;
UPDATE user_preferences t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE user_preferences ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_preferences DROP CONSTRAINT user_preferences_anon_id_key;
ALTER TABLE user_preferences DROP CONSTRAINT user_preferences_anon_fk;
ALTER TABLE user_preferences DROP COLUMN anon_id;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);
CREATE POLICY "user_isolation" ON user_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── user_habits ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON user_habits;
ALTER TABLE user_habits ADD COLUMN user_id UUID;
UPDATE user_habits t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE user_habits ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_habits ADD CONSTRAINT user_habits_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_habits DROP CONSTRAINT user_habits_anon_name_key;
DROP INDEX IF EXISTS idx_user_habits_anon_id;
ALTER TABLE user_habits DROP CONSTRAINT user_habits_anon_fk;
ALTER TABLE user_habits DROP COLUMN anon_id;
ALTER TABLE user_habits ADD CONSTRAINT user_habits_user_id_name_key UNIQUE (user_id, name);
CREATE INDEX idx_user_habits_user_id ON user_habits(user_id);
CREATE POLICY "user_isolation" ON user_habits
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── onboarding_states ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_isolation" ON onboarding_states;
ALTER TABLE onboarding_states ADD COLUMN user_id UUID;
UPDATE onboarding_states t SET user_id = p.id FROM profiles p WHERE p.anon_id = t.anon_id;
ALTER TABLE onboarding_states ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE onboarding_states ADD CONSTRAINT onboarding_states_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE onboarding_states DROP CONSTRAINT onboarding_states_anon_id_key;
DROP INDEX IF EXISTS idx_onboarding_anon_status;
ALTER TABLE onboarding_states DROP CONSTRAINT onboarding_states_anon_fk;
ALTER TABLE onboarding_states DROP COLUMN anon_id;
ALTER TABLE onboarding_states ADD CONSTRAINT onboarding_states_user_id_key UNIQUE (user_id);
CREATE INDEX idx_onboarding_user_status ON onboarding_states(user_id, status);
CREATE POLICY "user_isolation" ON onboarding_states
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── onboarding_selected_(categories|subcategories) RLS join rewrite ─────
DROP POLICY IF EXISTS "user_isolation" ON onboarding_selected_categories;
CREATE POLICY "user_isolation" ON onboarding_selected_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_isolation" ON onboarding_selected_subcategories;
CREATE POLICY "user_isolation" ON onboarding_selected_subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id AND user_id = auth.uid()
    )
  );

-- ── prune_session_log() — restore PARTITION BY user_id ──────────────────
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
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp DESC) AS rn
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

-- ── drop helper and bridge column last ──────────────────────────────────
DROP FUNCTION IF EXISTS public.current_anon_id();
ALTER TABLE profiles DROP COLUMN anon_id;
-- REVOKE SELECT (anon_id) is moot — column gone.

COMMIT;
