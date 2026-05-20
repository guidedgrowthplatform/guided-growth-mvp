-- 031_fix_admins_can_view_all_recursion_down.sql
-- Reverts 031 by restoring the recursive policy form. NOTE: that form
-- aborts at runtime with "infinite recursion detected in policy for
-- relation profiles". Down only exists for completeness; do not roll
-- back unless you also accept the broken policy state.

BEGIN;

CREATE POLICY "admins_can_view_all" ON public.profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;
