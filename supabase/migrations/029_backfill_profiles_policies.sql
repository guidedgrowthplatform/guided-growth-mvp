-- 029_backfill_profiles_policies.sql
-- Drift backfill discovered by scripts/audit-policy-drift.sql:
--   1. Migration 000 defined `users_can_update_own_profile` (snake_case) but
--      live DB has `"Users can update own profile"` instead — a dashboard-
--      created policy with the same body but a different name. Drop the
--      dashboard one and restore the migration version.
--   2. Migration 000 defined `admins_can_view_all` (FOR SELECT, role='admin')
--      but the live DB has no such policy on profiles. Restore it.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Align UPDATE policy name with migration 000
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;

CREATE POLICY "users_can_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Restore the admin SELECT policy from migration 000
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_can_view_all" ON public.profiles;

CREATE POLICY "admins_can_view_all" ON public.profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;
