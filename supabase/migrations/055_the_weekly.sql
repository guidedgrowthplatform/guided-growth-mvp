-- The Weekly: a once-a-week deep-dive coaching session in the check-in.
-- Runs after the daily reflection on a user-chosen day. This migration adds
-- the day-of-week setting (piggybacking on reflection_settings, same table
-- that already owns the evening-reflection schedule) and the table that
-- records each completed weekly session (focus, plan changes, insights).

BEGIN;

-- Which day of week The Weekly runs on. 0=Sunday .. 6=Saturday, matching the
-- schedule_days / user_habits.schedule_days convention. NULL = not chosen yet
-- (falls back to a default day in app logic until the user picks one).
ALTER TABLE reflection_settings
  ADD COLUMN IF NOT EXISTS weekly_day SMALLINT
    CHECK (weekly_day IS NULL OR (weekly_day BETWEEN 0 AND 6));

CREATE TABLE IF NOT EXISTS weekly_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id      UUID        NOT NULL REFERENCES profiles(anon_id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,
  week_end     DATE        NOT NULL,
  completed_at TIMESTAMPTZ,
  focus        TEXT,
  changes      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  insights     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (anon_id, week_end)
);

ALTER TABLE weekly_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_isolation" ON weekly_sessions;
CREATE POLICY "user_isolation" ON weekly_sessions
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_sessions TO authenticated;

COMMIT;
