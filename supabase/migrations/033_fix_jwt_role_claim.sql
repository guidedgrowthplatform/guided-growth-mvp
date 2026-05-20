-- 033_fix_jwt_role_claim.sql
-- Step 3 follow-up. The custom_access_token_hook (introduced in 000,
-- preserved in 026) overwrites the top-level JWT `role` claim with the
-- app's user role ('user' / 'admin' from profiles.role). PostgREST uses
-- the top-level role claim to issue `SET LOCAL ROLE <claim>` per
-- request — there's no Postgres role named 'user' or 'admin', so every
-- browser-direct REST call fails with PG 22023 'role "user" does not
-- exist' → HTTP 401.
--
-- The bug was dormant because all data flowed through /api/* using
-- service_role or the postgres role via pg.Pool. Step 3 moved the
-- browser to direct PostgREST calls, exposing it.
--
-- Fix: write the app role + status into claims.app_metadata.{role,status}.
-- Top-level `role` is left as Supabase Auth set it (typically
-- 'authenticated' for signed-in users). Both frontend authStore.mapUser
-- and api/_lib/auth.requireUser already read from app_metadata.role, so
-- no application code changes are required.
--
-- One-time effect: any session holding a JWT issued before this
-- migration will keep failing until the access token refreshes (~1h
-- TTL) or the user re-auths. Same forced-reauth window as 032.

BEGIN;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims          JSONB;
  app_metadata    JSONB;
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
  app_metadata := COALESCE(claims->'app_metadata', '{}'::jsonb);
  app_metadata := jsonb_set(app_metadata, '{role}',   to_jsonb(COALESCE(user_role,   'user')));
  app_metadata := jsonb_set(app_metadata, '{status}', to_jsonb(COALESCE(user_status, 'active')));
  claims := jsonb_set(claims, '{app_metadata}', app_metadata);

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

COMMENT ON FUNCTION public.custom_access_token_hook(JSONB) IS
  'Injects anon_id + first_name + app_metadata.{role,status} claims. Top-level role is left to Supabase Auth (PostgREST needs it to be a valid Postgres role).';

COMMIT;
