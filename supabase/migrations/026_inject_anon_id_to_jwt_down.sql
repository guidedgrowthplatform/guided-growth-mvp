-- 026_inject_anon_id_to_jwt_down.sql
-- Restores the pre-026 custom_access_token_hook body verbatim from 000_schema.sql.

BEGIN;

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

COMMIT;
