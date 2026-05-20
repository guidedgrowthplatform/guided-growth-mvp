-- 026_jwt_foundation_down.sql
-- Reverses 026_jwt_foundation.sql: restores pre-026 function bodies (from
-- 000_schema.sql and 025_anon_id.sql verbatim) and drops the documentation
-- policies on session_log + feedback.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Restore pre-026 custom_access_token_hook (verbatim from 000_schema.sql)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
  user_status TEXT;
BEGIN
  SELECT role, status
    INTO user_role, user_status
    FROM public.profiles
   WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';
  claims := jsonb_set(claims, '{role}',   to_jsonb(COALESCE(user_role, 'user')));
  claims := jsonb_set(claims, '{status}', to_jsonb(COALESCE(user_status, 'active')));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Restore pre-026 current_anon_id (verbatim from 025_anon_id.sql)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_anon_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT anon_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_anon_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_anon_id() TO authenticated, service_role;
ALTER FUNCTION public.current_anon_id() OWNER TO postgres;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Drop documentation policies
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_only" ON public.session_log;
DROP POLICY IF EXISTS "service_role_only" ON public.feedback;

COMMIT;
