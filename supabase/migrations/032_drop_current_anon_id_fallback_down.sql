-- 032_drop_current_anon_id_fallback_down.sql
-- Restore the JWT-first, profiles-fallback definition of
-- public.current_anon_id() exactly as shipped in migration 026.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_anon_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'anon_id')::UUID,
    (SELECT anon_id FROM public.profiles WHERE id = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.current_anon_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_anon_id() TO authenticated, service_role;
ALTER FUNCTION public.current_anon_id() OWNER TO postgres;

COMMIT;
