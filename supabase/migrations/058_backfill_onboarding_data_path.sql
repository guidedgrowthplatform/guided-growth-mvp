-- Backfill onboarding_states.data.path (render canon: 'beginner'|'advanced')
-- from the legacy top-level `path` column ('simple'|'braindump'). Dual-write is
-- live in submit_path_choice; this only seeds pre-existing rows. Idempotent.

BEGIN;

UPDATE onboarding_states
SET data = data || jsonb_build_object(
  'path',
  CASE path
    WHEN 'simple' THEN 'beginner'
    WHEN 'braindump' THEN 'advanced'
    ELSE path
  END
)
WHERE path IS NOT NULL
  AND (data->>'path') IS DISTINCT FROM CASE path
    WHEN 'simple' THEN 'beginner'
    WHEN 'braindump' THEN 'advanced'
    ELSE path
  END;

COMMIT;
