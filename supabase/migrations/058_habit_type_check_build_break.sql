-- 058_habit_type_check_build_break.sql
--
-- Reconcile habit_type onto the CANONICAL Build/Break values and lock the column
-- so a stale code path or typo cannot slip a third polarity past the app.
--   'binary_build' = build (do more of it; legacy 'binary_do')
--   'binary_break' = break (stay away from it; legacy 'binary_avoid')
--
-- WHY THIS MIGRATION EXISTS (duplicate-043 hygiene problem):
-- main carries TWO migrations that share version 043 and directly conflict:
--   * 043_habit_type_check.sql     -> ADD CHECK (habit_type IN ('binary_do','binary_avoid'))
--   * 043_rename_habit_polarity.sql -> UPDATE rows to 'binary_build'/'binary_break'
--                                      and SET DEFAULT 'binary_build'
-- They break two ways:
--   1. Wrong values: the check rejects 'binary_break', so a Break habit cannot
--      persist while that constraint is in place.
--   2. Wrong order: '043_habit_type_check.sql' sorts BEFORE
--      '043_rename_habit_polarity.sql' ('h' < 'r'), so on a fresh apply the
--      old-value CHECK is added first, and the rename's
--      UPDATE ... SET habit_type='binary_build' then VIOLATES it and aborts.
-- No later migration on main reconciles this. 058 does: it runs AFTER both 043
-- files (058 > 043) and after everything through 057, drops any prior
-- habit_type check, normalizes any legacy rows, and re-adds the constraint on
-- the correct new values.
--
-- RECOMMENDED FOLLOW-UP FOR A HUMAN (do NOT let a script do this silently):
-- The two committed 043 files are still a latent trap on any clean re-apply.
-- A maintainer should either DELETE 043_habit_type_check.sql (058 supersedes it
-- entirely) or RENAME it to a version that sorts AFTER 043_rename_habit_polarity
-- and rewrite its CHECK to the new values. This migration deliberately does NOT
-- edit or reorder those already-committed files; it only makes the END STATE
-- correct. Flag: supabase/migrations/043_habit_type_check.sql.
--
-- Idempotent: DROP ... IF EXISTS + a fixed constraint name + value-scoped
-- UPDATEs make re-runs a no-op.

BEGIN;

-- Remove any earlier habit_type check (e.g. the broken old-values 043 one) so we
-- can re-add the correct one. Safe if no such constraint exists.
ALTER TABLE user_habits
  DROP CONSTRAINT IF EXISTS user_habits_habit_type_check;

-- Normalize any legacy do/avoid rows to build/break, on both the live table and
-- the predefined templates, so the new constraint validates clean even if the
-- 043 rename was skipped or a stray legacy row slipped through.
UPDATE user_habits    SET habit_type = 'binary_build' WHERE habit_type = 'binary_do';
UPDATE user_habits    SET habit_type = 'binary_break' WHERE habit_type = 'binary_avoid';
UPDATE starter_habits SET habit_type = 'binary_build' WHERE habit_type = 'binary_do';
UPDATE starter_habits SET habit_type = 'binary_break' WHERE habit_type = 'binary_avoid';

ALTER TABLE user_habits
  ADD CONSTRAINT user_habits_habit_type_check
  CHECK (habit_type IN ('binary_build', 'binary_break'));

COMMIT;
