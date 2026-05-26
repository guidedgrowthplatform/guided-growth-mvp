BEGIN;

DROP POLICY IF EXISTS "anon_isolation" ON public.chat_messages;
DROP POLICY IF EXISTS "service_role_only" ON public.chat_messages;

COMMIT;
