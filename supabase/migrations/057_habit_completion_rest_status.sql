-- 057_habit_completion_rest_status.sql
--
-- Add 'rest' to the habit_completions status set (Rule 7: rest days are real and
-- do not break a streak). 045 anticipated this ("e.g. future 'skipped'") by using
-- TEXT+CHECK instead of a pg_enum, so widening is a single constraint swap, no
-- enum migration dance. A 'rest' row is a deliberate, preserved skip: streak math
-- BRIDGES it (does not break, does not count as a win), which is the difference
-- from an absent (pending) or 'missed' day. No default change — new rows still
-- default 'done'; a rest is only written explicitly by the coach's mark_rest tool
-- or the home-card rest toggle. Small table, so the inline CHECK re-validates clean.

BEGIN;

ALTER TABLE habit_completions
  DROP CONSTRAINT IF EXISTS habit_completions_status_check;

ALTER TABLE habit_completions
  ADD CONSTRAINT habit_completions_status_check
  CHECK (status IN ('done', 'missed', 'rest'));

COMMIT;
