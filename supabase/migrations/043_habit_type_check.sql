-- 043_habit_type_check.sql
--
-- Habit polarity (#224). user_habits.habit_type has existed since 001 (DEFAULT
-- 'binary_do') but was never constrained or read — every habit was effectively a
-- "do" habit. We now read it to drive avoid-habit framing ('binary_avoid' = success
-- when abstained). Lock the column to the two known values so a typo can't slip a
-- third polarity past the app. All existing rows are 'binary_do', so the constraint
-- validates clean; NOT VALID + VALIDATE would be overkill at current table size.
--
-- NOT YET APPLIED — pending review/approval.

BEGIN;

ALTER TABLE user_habits
  DROP CONSTRAINT IF EXISTS user_habits_habit_type_check;

ALTER TABLE user_habits
  ADD CONSTRAINT user_habits_habit_type_check
  CHECK (habit_type IN ('binary_do', 'binary_avoid'));

COMMIT;
