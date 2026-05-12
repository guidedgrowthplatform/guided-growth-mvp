-- Change session_log.id from BIGINT (BIGSERIAL) to UUID.
-- No other table FKs to session_log.id (verified via information_schema), so
-- a direct type change is safe. Existing rows get fresh UUIDs via the USING
-- clause — those ids weren't persisted anywhere outside this table, so the
-- rewrite is harmless.
-- pgcrypto (gen_random_uuid) is already installed.

DO $$
BEGIN
  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session_log'
      AND column_name = 'id'
  ) <> 'uuid' THEN
    ALTER TABLE public.session_log ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.session_log
      ALTER COLUMN id TYPE uuid USING gen_random_uuid();
    ALTER TABLE public.session_log
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- The old BIGSERIAL sequence is now orphaned.
DROP SEQUENCE IF EXISTS public.session_log_id_seq;
