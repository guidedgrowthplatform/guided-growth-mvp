-- 026_jwt_foundation.sql
-- Step 1 of the RLS-enforced architecture redirect. Three changes, one
-- transaction:
--   1. custom_access_token_hook now injects anon_id + first_name into JWT
--      claims alongside the existing role/status.
--   2. current_anon_id() reads anon_id from the JWT first, with a profiles
--      fallback so tokens issued before the hook was wired keep working.
--      The fallback is removed in a follow-up migration after all sessions
--      have cycled (~7-day window).
--   3. Explicit service_role-only policies on session_log and feedback so
--      the policy graph is complete in SQL (behavior unchanged — service_role
--      bypasses RLS already; authenticated still sees zero rows).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. JWT hook
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims          JSONB;
  user_role       TEXT;
  user_status     TEXT;
  user_anon_id    UUID;
  user_first_name TEXT;
BEGIN
  SELECT role,
         status,
         anon_id,
         NULLIF(split_part(trim(COALESCE(name, '')), ' ', 1), '')
    INTO user_role, user_status, user_anon_id, user_first_name
    FROM public.profiles
   WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';
  claims := jsonb_set(claims, '{role}',    to_jsonb(COALESCE(user_role,   'user')));
  claims := jsonb_set(claims, '{status}',  to_jsonb(COALESCE(user_status, 'active')));
  IF user_anon_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{anon_id}', to_jsonb(user_anon_id));
  END IF;
  IF user_first_name IS NOT NULL THEN
    claims := jsonb_set(claims, '{first_name}', to_jsonb(user_first_name));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

ALTER FUNCTION public.custom_access_token_hook(JSONB) OWNER TO postgres;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. current_anon_id — JWT-first with profiles fallback
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Explicit service_role policies on session_log + feedback
-- ─────────────────────────────────────────────────────────────────────────
CREATE POLICY "service_role_only" ON public.session_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_only" ON public.feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
