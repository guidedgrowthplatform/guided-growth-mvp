-- P1-21 post-apply: anon_id backfill validation.
--
-- Purpose:   After migration 025_anon_id.sql has been applied, verifies for
--            each of the 15 behavioral/config/onboarding tables that
--              (a) no row has anon_id IS NULL (NOT NULL guarantee), and
--              (b) every row's anon_id resolves to a profiles.anon_id (FK).
-- When:     Run AFTER applying supabase/migrations/025_anon_id.sql.
-- How:      psql "$DATABASE_URL" -f scripts/validate-anon-id-backfill.sql
-- Interpret: Every row should show null_count = 0 AND fk_violation_count = 0.
--            Any nonzero value indicates a backfill or FK regression.
-- Safety:   Read-only. No DDL, no DML, no transaction.

WITH checks AS (
  SELECT 'session_log'::text AS table_name,
         count(*) FILTER (WHERE t.anon_id IS NULL)::bigint AS null_count,
         count(*) FILTER (
           WHERE t.anon_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id)
         )::bigint AS fk_violation_count
    FROM session_log t
  UNION ALL SELECT 'user_habits',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM user_habits t
  UNION ALL SELECT 'habit_completions',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM habit_completions t
  UNION ALL SELECT 'daily_checkins',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM daily_checkins t
  UNION ALL SELECT 'journal_entries',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM journal_entries t
  UNION ALL SELECT 'reflections',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM reflections t
  UNION ALL SELECT 'metrics',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM metrics t
  UNION ALL SELECT 'metric_entries',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM metric_entries t
  UNION ALL SELECT 'entries',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM entries t
  UNION ALL SELECT 'focus_sessions',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM focus_sessions t
  UNION ALL SELECT 'feedback',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM feedback t
  UNION ALL SELECT 'user_preferences',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM user_preferences t
  UNION ALL SELECT 'reflection_configs',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM reflection_configs t
  UNION ALL SELECT 'affirmations',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM affirmations t
  UNION ALL SELECT 'onboarding_states',
    count(*) FILTER (WHERE t.anon_id IS NULL),
    count(*) FILTER (WHERE t.anon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.anon_id = t.anon_id))
    FROM onboarding_states t
)
SELECT table_name, null_count, fk_violation_count
FROM checks
ORDER BY (null_count + fk_violation_count) DESC, table_name ASC;

\echo
\echo 'Expected output: every table at null_count=0 AND fk_violation_count=0.'
