-- 029_backfill_profiles_policies_down.sql
-- Reverses 029: removes the restored `admins_can_view_all` policy and
-- renames `users_can_update_own_profile` back to the dashboard-style
-- `"Users can update own profile"` so the live DB returns to its
-- pre-029 shape.

BEGIN;

DROP POLICY IF EXISTS "admins_can_view_all" ON public.profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;
