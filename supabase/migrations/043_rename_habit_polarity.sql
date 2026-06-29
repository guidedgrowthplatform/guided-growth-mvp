-- 043_rename_habit_polarity.sql
-- Rename the habit polarity values from do/avoid to build/break.
--   'binary_do'    -> 'binary_build'   (build: do more of it)
--   'binary_avoid' -> 'binary_break'   (break: stay away from it)
-- The habit_type columns are plain VARCHAR(50) with no CHECK constraint, so the
-- DB accepts either spelling. This only rewrites rows still on the legacy values
-- and is safe to run once. Re-running is a no-op (no rows match after the first
-- pass).
--
-- ORDERING: run this only after the application code that reads habit_type
-- understands the new values (or tolerates both). See gg-spec/docs/habit-polarity.md.

BEGIN;

-- Real user habits
UPDATE user_habits   SET habit_type = 'binary_build' WHERE habit_type = 'binary_do';
UPDATE user_habits   SET habit_type = 'binary_break' WHERE habit_type = 'binary_avoid';

-- Pre-defined habit templates
UPDATE starter_habits SET habit_type = 'binary_build' WHERE habit_type = 'binary_do';
UPDATE starter_habits SET habit_type = 'binary_break' WHERE habit_type = 'binary_avoid';

-- New rows default to the build polarity
ALTER TABLE user_habits ALTER COLUMN habit_type SET DEFAULT 'binary_build';

COMMIT;
