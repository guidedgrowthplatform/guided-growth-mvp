-- Row Level Security (RLS) policies using current_setting('app.current_user_id')
-- Called by setUserContext(userId) in every API handler

-- Enable RLS on all user-owned tables
ALTER TABLE onboarding_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_selected_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_selected_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE affirmations ENABLE ROW LEVEL SECURITY;

-- Standard isolation policy for tables with direct user_id column
CREATE POLICY "user_isolation" ON onboarding_states
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON user_habits
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON user_preferences
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON habit_completions
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON metrics
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON metric_entries
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON daily_checkins
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON journal_entries
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON reflection_configs
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON reflections
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON focus_sessions
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- onboarding_selected_* use onboarding_state_id FK — policy via EXISTS join
CREATE POLICY "user_isolation" ON onboarding_selected_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id
        AND user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "user_isolation" ON onboarding_selected_subcategories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM onboarding_states
      WHERE id = onboarding_state_id
        AND user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "user_isolation" ON entries
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "user_isolation" ON affirmations
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- No RLS on these tables (service role access only):
-- - allowlist (signup gating, no user FK)
-- - categories, subcategories, starter_habits (seeded read-only data, no user FK)
-- - admin_audit_log (admin only, checked via requireAdmin in API layer)
