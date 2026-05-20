-- Down for 033. Restores the buggy 026 definition that overwrites the
-- top-level JWT `role` claim. Apply only to fully revert 033; expect
-- PostgREST role-switching to break again for browser-direct calls.

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

COMMIT;
