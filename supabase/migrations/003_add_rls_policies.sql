-- ═══════════════════════════════════════════════════════════════════
-- 003_add_rls_policies.sql
-- Row Level Security for all tables
-- Policy: users see only their own rows; seeded tables are read-only
-- Service role bypasses RLS for admin operations
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- Enable RLS on ALL tables
-- ─────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE starter_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_selected_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_selected_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- SEEDED / READ-ONLY TABLES — all authenticated users can read
-- ═══════════════════════════════════════════════════════════════════

-- categories
CREATE POLICY categories_select ON categories
  FOR SELECT TO authenticated USING (true);

-- subcategories
CREATE POLICY subcategories_select ON subcategories
  FOR SELECT TO authenticated USING (true);

-- starter_habits
CREATE POLICY starter_habits_select ON starter_habits
  FOR SELECT TO authenticated USING (true);

-- identity_goals
CREATE POLICY identity_goals_select ON identity_goals
  FOR SELECT TO authenticated USING (true);

-- journal_categories
CREATE POLICY journal_categories_select ON journal_categories
  FOR SELECT TO authenticated USING (true);

-- milestones
CREATE POLICY milestones_select ON milestones
  FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- USER-OWNED TABLES — own rows only (WHERE user_id = auth.uid())
-- ═══════════════════════════════════════════════════════════════════

-- users (own profile)
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_update ON users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_habits
CREATE POLICY user_habits_select ON user_habits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_habits_insert ON user_habits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_habits_update ON user_habits
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_habits_delete ON user_habits
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- habit_completions (via user_habits join)
CREATE POLICY habit_completions_select ON habit_completions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_completions.user_habit_id AND user_habits.user_id = auth.uid()
  ));
CREATE POLICY habit_completions_insert ON habit_completions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_completions.user_habit_id AND user_habits.user_id = auth.uid()
  ));
CREATE POLICY habit_completions_update ON habit_completions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_completions.user_habit_id AND user_habits.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_completions.user_habit_id AND user_habits.user_id = auth.uid()
  ));
CREATE POLICY habit_completions_delete ON habit_completions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_completions.user_habit_id AND user_habits.user_id = auth.uid()
  ));

-- habit_streaks (via user_habits join)
CREATE POLICY habit_streaks_select ON habit_streaks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_streaks.user_habit_id AND user_habits.user_id = auth.uid()
  ));
CREATE POLICY habit_streaks_insert ON habit_streaks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_streaks.user_habit_id AND user_habits.user_id = auth.uid()
  ));
CREATE POLICY habit_streaks_update ON habit_streaks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_streaks.user_habit_id AND user_habits.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_habits WHERE user_habits.id = habit_streaks.user_habit_id AND user_habits.user_id = auth.uid()
  ));

-- daily_checkins
CREATE POLICY daily_checkins_select ON daily_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY daily_checkins_insert ON daily_checkins
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_checkins_update ON daily_checkins
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_checkins_delete ON daily_checkins
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- journal_entries
CREATE POLICY journal_entries_select ON journal_entries
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY journal_entries_insert ON journal_entries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY journal_entries_update ON journal_entries
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY journal_entries_delete ON journal_entries
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- focus_sessions
CREATE POLICY focus_sessions_select ON focus_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY focus_sessions_insert ON focus_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY focus_sessions_update ON focus_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY focus_sessions_delete ON focus_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_milestones
CREATE POLICY user_milestones_select ON user_milestones
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_milestones_insert ON user_milestones
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_milestones_delete ON user_milestones
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_points
CREATE POLICY user_points_select ON user_points
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_points_insert ON user_points
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- onboarding_states
CREATE POLICY onboarding_states_select ON onboarding_states
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY onboarding_states_insert ON onboarding_states
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY onboarding_states_update ON onboarding_states
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- onboarding_selected_categories (via onboarding_states join)
CREATE POLICY onboarding_selected_categories_select ON onboarding_selected_categories
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM onboarding_states WHERE onboarding_states.id = onboarding_selected_categories.onboarding_state_id AND onboarding_states.user_id = auth.uid()
  ));
CREATE POLICY onboarding_selected_categories_insert ON onboarding_selected_categories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM onboarding_states WHERE onboarding_states.id = onboarding_selected_categories.onboarding_state_id AND onboarding_states.user_id = auth.uid()
  ));
CREATE POLICY onboarding_selected_categories_delete ON onboarding_selected_categories
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM onboarding_states WHERE onboarding_states.id = onboarding_selected_categories.onboarding_state_id AND onboarding_states.user_id = auth.uid()
  ));

-- onboarding_selected_subcategories (via onboarding_states join)
CREATE POLICY onboarding_selected_subcategories_select ON onboarding_selected_subcategories
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM onboarding_states WHERE onboarding_states.id = onboarding_selected_subcategories.onboarding_state_id AND onboarding_states.user_id = auth.uid()
  ));
CREATE POLICY onboarding_selected_subcategories_insert ON onboarding_selected_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM onboarding_states WHERE onboarding_states.id = onboarding_selected_subcategories.onboarding_state_id AND onboarding_states.user_id = auth.uid()
  ));
CREATE POLICY onboarding_selected_subcategories_delete ON onboarding_selected_subcategories
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM onboarding_states WHERE onboarding_states.id = onboarding_selected_subcategories.onboarding_state_id AND onboarding_states.user_id = auth.uid()
  ));

-- user_settings
CREATE POLICY user_settings_select ON user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_settings_insert ON user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_settings_update ON user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- metrics
CREATE POLICY metrics_select ON metrics
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY metrics_insert ON metrics
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY metrics_update ON metrics
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY metrics_delete ON metrics
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- metric_entries (via metrics join)
CREATE POLICY metric_entries_select ON metric_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM metrics WHERE metrics.id = metric_entries.metric_id AND metrics.user_id = auth.uid()
  ));
CREATE POLICY metric_entries_insert ON metric_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM metrics WHERE metrics.id = metric_entries.metric_id AND metrics.user_id = auth.uid()
  ));
CREATE POLICY metric_entries_update ON metric_entries
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM metrics WHERE metrics.id = metric_entries.metric_id AND metrics.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM metrics WHERE metrics.id = metric_entries.metric_id AND metrics.user_id = auth.uid()
  ));
CREATE POLICY metric_entries_delete ON metric_entries
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM metrics WHERE metrics.id = metric_entries.metric_id AND metrics.user_id = auth.uid()
  ));

-- user_preferences
CREATE POLICY user_preferences_select ON user_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_preferences_insert ON user_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_preferences_update ON user_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- tasks
CREATE POLICY tasks_select ON tasks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY tasks_insert ON tasks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY tasks_update ON tasks
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tasks_delete ON tasks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ai_conversations
CREATE POLICY ai_conversations_select ON ai_conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ai_conversations_insert ON ai_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_conversations_delete ON ai_conversations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- SERVICE ROLE BYPASS
-- The Supabase service_role key bypasses RLS by default.
-- No additional policies needed for admin/service operations.
-- ═══════════════════════════════════════════════════════════════════
