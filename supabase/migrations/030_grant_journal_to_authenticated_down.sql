-- 030_grant_journal_to_authenticated_down.sql

BEGIN;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.journal_entries FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_fields FROM authenticated;

COMMIT;
