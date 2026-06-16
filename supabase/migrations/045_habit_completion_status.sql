-- 045_habit_completion_status.sql
--
-- 3-state habit-day model (pending/done/missed). Until now a habit_completions
-- row meant "done"; absence meant pending OR missed (indistinguishable). Add an
-- explicit status so "missed" can be recorded (breaks streak) while pending stays
-- sparse (no row). TEXT+CHECK, not a Postgres ENUM, to match repo convention
-- (043_habit_type_check.sql) — cheaper to evolve (e.g. future 'skipped'), no
-- pg_enum migration dance. DEFAULT 'done' backfills every existing row to 'done',
-- which is correct: each pre-existing row was a completion. Small table, so the
-- inline CHECK validates clean without NOT VALID + VALIDATE.
--
-- NOT YET APPLIED — pending review/approval.

BEGIN;

ALTER TABLE habit_completions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done';

ALTER TABLE habit_completions
  DROP CONSTRAINT IF EXISTS habit_completions_status_check;

ALTER TABLE habit_completions
  ADD CONSTRAINT habit_completions_status_check
  CHECK (status IN ('done', 'missed'));

COMMIT;
