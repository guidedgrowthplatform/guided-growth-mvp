-- 031_fix_admins_can_view_all_recursion.sql
-- Migration 029 restored admins_can_view_all from 000_schema.sql verbatim,
-- but the policy form has infinite recursion: USING (SELECT role FROM
-- profiles WHERE id = auth.uid()) re-evaluates every profiles RLS policy
-- on the subquery, including itself.
--
-- Today no code path needs this policy — all admin endpoints use the
-- service-role connection (bypasses RLS). Drop it. If a future endpoint
-- ever needs admin SELECT via authenticated JWT, add it back with a
-- SECURITY DEFINER helper at that point.

BEGIN;

DROP POLICY IF EXISTS "admins_can_view_all" ON public.profiles;

COMMIT;
