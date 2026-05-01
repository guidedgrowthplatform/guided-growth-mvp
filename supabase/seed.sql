-- ═══════════════════════════════════════════════════════════════════
-- Guided Growth — Seed Data
-- ───────────────────────────────────────────────────────────────────
-- Realistic sample data for 1 test user
-- Matches MockDataService seed data from MVP-03
-- Usage: Run in Supabase SQL Editor after migration.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- Test User (matches Supabase Auth test user)
-- ─────────────────────────────────────────
-- Note: The user must exist in auth.users first (via Supabase Auth signup)
-- This seeds the app-level profile + sample data

DO $$
DECLARE
  test_user_id TEXT;
  habit_meditation UUID;
  habit_exercise UUID;
  habit_reading UUID;
BEGIN
  -- Use the first user in the system, or create a profile
  SELECT id INTO test_user_id FROM "user" LIMIT 1;

  IF test_user_id IS NULL THEN
    -- If no user exists yet, we can't seed (need auth.users first)
    RAISE NOTICE 'No user found — skipping seed. Create a user via Supabase Auth first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding data for user: %', test_user_id;

  -- ─────────────────────────────────────────
  -- Sample Habits (matching MVP-03 mock data)
  -- ─────────────────────────────────────────

  INSERT INTO user_habits (id, user_id, name, habit_type, cadence, daily_goal, is_active)
  VALUES
    (gen_random_uuid(), test_user_id, 'Meditation', 'binary_do', 'daily', 1, TRUE),
    (gen_random_uuid(), test_user_id, 'Exercise', 'binary_do', 'weekdays', 1, TRUE),
    (gen_random_uuid(), test_user_id, 'Reading', 'binary_do', 'daily', 1, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING id INTO habit_meditation;

  -- Get habit IDs for completions
  SELECT id INTO habit_meditation FROM user_habits WHERE user_id = test_user_id AND name = 'Meditation' LIMIT 1;
  SELECT id INTO habit_exercise FROM user_habits WHERE user_id = test_user_id AND name = 'Exercise' LIMIT 1;
  SELECT id INTO habit_reading FROM user_habits WHERE user_id = test_user_id AND name = 'Reading' LIMIT 1;

  -- ─────────────────────────────────────────
  -- Sample Completions (last 7 days)
  -- ─────────────────────────────────────────

  IF habit_meditation IS NOT NULL THEN
    INSERT INTO habit_completions (user_habit_id, date, completed, completed_via)
    VALUES
      (habit_meditation, CURRENT_DATE - INTERVAL '6 days', TRUE, 'ui'),
      (habit_meditation, CURRENT_DATE - INTERVAL '5 days', TRUE, 'ui'),
      (habit_meditation, CURRENT_DATE - INTERVAL '4 days', TRUE, 'voice'),
      (habit_meditation, CURRENT_DATE - INTERVAL '3 days', FALSE, 'ui'),
      (habit_meditation, CURRENT_DATE - INTERVAL '2 days', TRUE, 'ui'),
      (habit_meditation, CURRENT_DATE - INTERVAL '1 day', TRUE, 'voice')
    ON CONFLICT (user_habit_id, date) DO NOTHING;
  END IF;

  IF habit_exercise IS NOT NULL THEN
    INSERT INTO habit_completions (user_habit_id, date, completed, completed_via)
    VALUES
      (habit_exercise, CURRENT_DATE - INTERVAL '5 days', TRUE, 'ui'),
      (habit_exercise, CURRENT_DATE - INTERVAL '3 days', TRUE, 'ui'),
      (habit_exercise, CURRENT_DATE - INTERVAL '1 day', TRUE, 'voice')
    ON CONFLICT (user_habit_id, date) DO NOTHING;
  END IF;

  -- ─────────────────────────────────────────
  -- Sample Streaks
  -- ─────────────────────────────────────────

  IF habit_meditation IS NOT NULL THEN
    INSERT INTO habit_streaks (user_habit_id, current_streak, longest_streak, total_completions, total_scheduled, completion_rate)
    VALUES (habit_meditation, 2, 3, 5, 7, 0.71)
    ON CONFLICT (user_habit_id) DO NOTHING;
  END IF;

  IF habit_exercise IS NOT NULL THEN
    INSERT INTO habit_streaks (user_habit_id, current_streak, longest_streak, total_completions, total_scheduled, completion_rate)
    VALUES (habit_exercise, 1, 2, 3, 5, 0.60)
    ON CONFLICT (user_habit_id) DO NOTHING;
  END IF;

  -- ─────────────────────────────────────────
  -- Sample Daily Check-ins
  -- ─────────────────────────────────────────

  INSERT INTO daily_checkins (user_id, date, mood, energy, stress, sleep)
  VALUES
    (test_user_id, CURRENT_DATE - INTERVAL '2 days', 4, 4, 4, 4),
    (test_user_id, CURRENT_DATE - INTERVAL '1 day', 5, 5, 5, 5),
    (test_user_id, CURRENT_DATE, 3, 3, 3, 3)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- ─────────────────────────────────────────
  -- Sample Journal Entries
  -- ─────────────────────────────────────────

  INSERT INTO journal_entries (user_id, date, response, input_mode)
  VALUES
    (test_user_id, CURRENT_DATE - INTERVAL '1 day',
     'Had a productive day. Meditation session was great, feeling centered. Need to keep up with exercise routine.',
     'text'),
    (test_user_id, CURRENT_DATE,
     'Feeling a bit tired today but still managed to get some reading done. Want to try a morning workout tomorrow.',
     'voice')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data inserted successfully!';
END $$;
