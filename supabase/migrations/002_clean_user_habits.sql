DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_habits' AND column_name = 'selected_days'
  ) THEN
    ALTER TABLE user_habits RENAME COLUMN selected_days TO schedule_days;
  END IF;
END $$;

ALTER TABLE user_habits
  DROP COLUMN IF EXISTS habit_statement,
  DROP COLUMN IF EXISTS identity_goal_id,
  DROP COLUMN IF EXISTS "trigger",
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS completion_rule,
  DROP COLUMN IF EXISTS time_of_day,
  DROP COLUMN IF EXISTS preferred_time,
  DROP COLUMN IF EXISTS cutoff_value,
  DROP COLUMN IF EXISTS threshold_value,
  DROP COLUMN IF EXISTS linked_event,
  DROP COLUMN IF EXISTS is_journaling,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS frequency;
