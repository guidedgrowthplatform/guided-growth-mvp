-- 032_drop_current_anon_id_fallback.sql
-- Step 3 slice A of the RLS-enforced architecture redirect. Drops the
-- profiles-lookup COALESCE fallback from public.current_anon_id() now that
-- the JWT hook installed in 026 has been live long enough for every active
-- session to have cycled through a token that carries the anon_id claim.
--
-- Why now: keeping the profiles fallback masks tokens issued without the
-- claim and lets RLS silently degrade to a database lookup. Removing it
-- makes current_anon_id() strictly JWT-driven so any future regression in
-- the token hook fails closed (NULL) rather than open.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_anon_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'anon_id')::UUID
$$;

COMMIT;
