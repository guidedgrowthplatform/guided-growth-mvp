-- P1-04 retention: nightly cron, keep last 20 events per user. No TTL.
-- pg_cron prerequisite: Pro/Team auto-enable; Free tier requires manual
-- Dashboard → Database → Extensions → pg_cron before this migration runs.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.prune_session_log()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  deleted_count INT;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp DESC) AS rn
    FROM public.session_log
  )
  DELETE FROM public.session_log
  WHERE id IN (
    SELECT id FROM ranked WHERE rn > 20
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'prune_session_log deleted % row(s)', deleted_count;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_session_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_session_log() TO postgres, service_role;

-- Idempotent schedule: drop any previous job with this name, then schedule fresh.
-- Runs daily at 03:00 UTC (low-traffic window).
DO $$
DECLARE
  existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'prune-session-log';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
  PERFORM cron.schedule(
    'prune-session-log',
    '0 3 * * *',
    'SELECT public.prune_session_log();'
  );
END $$;
