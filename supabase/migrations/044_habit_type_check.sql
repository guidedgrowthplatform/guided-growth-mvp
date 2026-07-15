-- 044_habit_type_check.sql
--
-- Lock user_habits.habit_type to the NEW polarity values ('binary_build',
-- 'binary_break') so a typo or a stale code path cannot slip a third polarity
-- past the app.
--
-- WHY 044 AND NOT 043:
-- An earlier, UNMERGED draft (origin/feat/self-hosted-previews) carries a file
-- named 043_habit_type_check.sql that adds CHECK (habit_type IN ('binary_do',
-- 'binary_avoid')) — the OLD values. That file is broken twice over:
--   1. Wrong values: it rejects 'binary_break', so a Break habit cannot persist.
--   2. Wrong order: '043_habit_type_check.sql' sorts BEFORE
--      '043_rename_habit_polarity.sql' ('h' < 'r'), so if it ever ran it would
--      add the old-value constraint first, and the rename's
--      UPDATE ... SET habit_type='binary_build' would then VIOLATE it and abort
--      the migration.
-- This migration supersedes that draft: it is numbered 044 so it is GUARANTEED
-- to run AFTER 043_rename_habit_polarity.sql, it drops any pre-existing
-- habit_type check (old values or none), backfills any legacy rows for safety,
-- and adds the constraint on the correct new values.
--
-- The stray 043_habit_type_check.sql on feat/self-hosted-previews MUST be
-- deleted before that branch merges — do NOT let both files land, or the deploy
-- breaks at the rename step described above.
--
-- Idempotent: DROP ... IF EXISTS + a fixed constraint name make re-runs a no-op.

BEGIN;

-- Remove any earlier habit_type check (e.g. the broken old-values one) so we can
-- re-add the correct one. Safe if no constraint exists.
ALTER TABLE user_habits
  DROP CONSTRAINT IF EXISTS user_habits_habit_type_check;

-- Backfill legacy values in case the rename migration was skipped or a stray row
-- slipped through, so the new constraint validates clean.
UPDATE user_habits SET habit_type = 'binary_build' WHERE habit_type = 'binary_do';
UPDATE user_habits SET habit_type = 'binary_break' WHERE habit_type = 'binary_avoid';

ALTER TABLE user_habits
  ADD CONSTRAINT user_habits_habit_type_check
  CHECK (habit_type IN ('binary_build', 'binary_break'));

COMMIT;
