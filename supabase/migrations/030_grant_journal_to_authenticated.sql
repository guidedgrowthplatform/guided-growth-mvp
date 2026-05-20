-- 030_grant_journal_to_authenticated.sql
-- Drift discovered post-026: journal_entries and journal_entry_fields have
-- RLS policies via current_anon_id() (per migration 025) but the
-- `authenticated` role has zero table-level privileges on them — so
-- supabase-js calls from the browser get "permission denied for table"
-- before RLS even evaluates.
--
-- Other user-data tables (daily_checkins, user_habits, metrics, etc.)
-- already have these grants. This migration brings journal_entries +
-- journal_entry_fields in line with the rest, unblocking the browser-
-- direct data path in Step 2.
--
-- feedback and session_log intentionally stay with no grants — they are
-- service-role-only by policy (see migration 026's service_role_only
-- policies). Do not add authenticated grants there.

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_fields TO authenticated;

COMMIT;
