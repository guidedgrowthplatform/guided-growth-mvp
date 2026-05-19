-- P1-21 pre-flight: anon_id backfill orphan audit.
--
-- Purpose:   Counts rows whose user_id has no matching profiles.id across the
--            15 behavioral/config/onboarding tables touched by migration
--            025_anon_id.sql. Such rows would backfill to NULL and abort the
--            SET NOT NULL step.
-- When:     Run BEFORE applying supabase/migrations/025_anon_id.sql.
-- How:      psql "$DATABASE_URL" -f scripts/audit-anon-id-orphans.sql
-- Interpret: Every row should show orphan_count = 0. Any value > 0 means
--            delete/repair those orphans before applying 025, or the
--            migration's ALTER COLUMN anon_id SET NOT NULL will fail.
-- Safety:   Read-only. No DDL, no DML, no transaction.

WITH counts AS (
  SELECT 'session_log'::text AS table_name, count(*)::bigint AS orphan_count
    FROM session_log t WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'user_habits', count(*) FROM user_habits t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'habit_completions', count(*) FROM habit_completions t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'daily_checkins', count(*) FROM daily_checkins t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'journal_entries', count(*) FROM journal_entries t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'reflections', count(*) FROM reflections t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'metrics', count(*) FROM metrics t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'metric_entries', count(*) FROM metric_entries t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'entries', count(*) FROM entries t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'focus_sessions', count(*) FROM focus_sessions t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'feedback', count(*) FROM feedback t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'user_preferences', count(*) FROM user_preferences t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'reflection_configs', count(*) FROM reflection_configs t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'affirmations', count(*) FROM affirmations t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
  UNION ALL SELECT 'onboarding_states', count(*) FROM onboarding_states t
    WHERE t.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.user_id)
)
SELECT table_name, orphan_count
FROM counts
ORDER BY orphan_count DESC, table_name ASC;

\echo
\echo 'Expected output: every table at 0 orphans. Any nonzero row must be resolved before applying 025_anon_id.sql.'
