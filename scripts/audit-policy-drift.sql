-- audit-policy-drift.sql
-- Dumps every RLS policy and SECURITY DEFINER function in the public schema.
-- Run against staging/prod before each release; diff manually against the
-- CREATE POLICY / CREATE FUNCTION statements in supabase/migrations/. Any
-- row that isn't reproducible from migrations is drift — backfill into the
-- next migration (or drop if obsolete).
--
-- How:  psql "$DATABASE_URL" -f scripts/audit-policy-drift.sql
-- Safe: read-only.

\pset format aligned
\pset tuples_only off

\echo
\echo === RLS policies (public schema) ===
\echo

SELECT schemaname,
       tablename,
       policyname,
       cmd,
       roles,
       qual,
       with_check
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;

\echo
\echo === SECURITY DEFINER functions (public schema) ===
\echo

SELECT n.nspname            AS schema,
       p.proname            AS function,
       pg_get_userbyid(p.proowner) AS owner,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef          AS security_definer,
       p.provolatile        AS volatility
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosecdef = TRUE
 ORDER BY p.proname;

\echo
\echo === Tables with RLS enabled (public schema) ===
\echo

SELECT n.nspname AS schema,
       c.relname AS table,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity = TRUE
 ORDER BY c.relname;
