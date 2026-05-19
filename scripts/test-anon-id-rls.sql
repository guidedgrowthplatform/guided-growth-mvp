-- P1-21 MR-B: anon_id RLS isolation test.
--
-- Purpose:   Verifies current_anon_id() + per-table RLS policies enforce
--            tenant boundaries across the join-bearing tables touched by
--            migration 025 (journal_entries / journal_entry_fields and
--            onboarding_states / onboarding_selected_categories).
-- When:     Run pre-launch against a staging or local Supabase DB. Operator-
--            run only; no CI integration yet.
-- How:      psql "$DATABASE_URL" -f scripts/test-anon-id-rls.sql
-- Interpret: Final SELECT prints (assertion, expected, actual, status). Every
--            row should report status = 'PASS'. Any 'FAIL' means tenant
--            isolation is broken — do not ship.
-- Safety:   Entire script runs inside a single BEGIN/ROLLBACK transaction.
--            Seed rows are discarded; the database is left unchanged.

BEGIN;

-- ── 1. Seed two auth.users; handle_new_user trigger creates profiles+anon_id ──
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_test_a@example.invalid'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_test_b@example.invalid');

CREATE TEMP TABLE rls_users AS
SELECT u.id           AS auth_user_id,
       p.anon_id      AS anon_id,
       u.email        AS email
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
 WHERE u.email IN ('rls_test_a@example.invalid', 'rls_test_b@example.invalid');

-- ── 2. Seed representative parent + child rows for each user ──
WITH a AS (SELECT auth_user_id, anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid'),
     b AS (SELECT auth_user_id, anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid'),
     je_a AS (
       INSERT INTO journal_entries (id, anon_id, type, date)
       SELECT gen_random_uuid(), anon_id, 'freeform', CURRENT_DATE FROM a
       RETURNING id, anon_id
     ),
     je_b AS (
       INSERT INTO journal_entries (id, anon_id, type, date)
       SELECT gen_random_uuid(), anon_id, 'freeform', CURRENT_DATE FROM b
       RETURNING id, anon_id
     ),
     jef_a AS (
       INSERT INTO journal_entry_fields (entry_id, field_key, content)
       SELECT id, 'body', 'A field' FROM je_a
       RETURNING entry_id
     ),
     jef_b AS (
       INSERT INTO journal_entry_fields (entry_id, field_key, content)
       SELECT id, 'body', 'B field' FROM je_b
       RETURNING entry_id
     ),
     os_a AS (
       INSERT INTO onboarding_states (anon_id, current_step, status)
       SELECT anon_id, 0, 'in_progress' FROM a
       RETURNING id
     ),
     os_b AS (
       INSERT INTO onboarding_states (anon_id, current_step, status)
       SELECT anon_id, 0, 'in_progress' FROM b
       RETURNING id
     ),
     cat AS (SELECT id FROM categories ORDER BY sort_order, slug LIMIT 1),
     osc_a AS (
       INSERT INTO onboarding_selected_categories (onboarding_state_id, category_id)
       SELECT os_a.id, cat.id FROM os_a, cat
       RETURNING id
     ),
     osc_b AS (
       INSERT INTO onboarding_selected_categories (onboarding_state_id, category_id)
       SELECT os_b.id, cat.id FROM os_b, cat
       RETURNING id
     )
SELECT 1;

-- ── 3. Results sink ──
CREATE TEMP TABLE rls_results (
  assertion TEXT,
  expected  INT,
  actual    INT,
  status    TEXT
);

-- ── 4. As user A ──
-- set_config(name, value, is_local) — SET LOCAL does not accept subqueries.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', auth_user_id::text)::text,
  true
) FROM rls_users WHERE email = 'rls_test_a@example.invalid';
SET LOCAL ROLE authenticated;

INSERT INTO rls_results (assertion, expected, actual, status)
SELECT 'A: current_anon_id matches profile',
       1,
       (CASE WHEN current_anon_id() = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid') THEN 1 ELSE 0 END),
       (CASE WHEN current_anon_id() = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid') THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: journal_entries visible = 1',
       1,
       (SELECT count(*)::int FROM journal_entries),
       (CASE WHEN (SELECT count(*) FROM journal_entries) = 1 THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: journal_entries leakage of B = 0',
       0,
       (SELECT count(*)::int FROM journal_entries
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM journal_entries
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: journal_entry_fields visible = 1 (join policy)',
       1,
       (SELECT count(*)::int FROM journal_entry_fields),
       (CASE WHEN (SELECT count(*) FROM journal_entry_fields) = 1 THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: onboarding_states visible = 1',
       1,
       (SELECT count(*)::int FROM onboarding_states),
       (CASE WHEN (SELECT count(*) FROM onboarding_states) = 1 THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: onboarding_selected_categories visible = 1 (join policy)',
       1,
       (SELECT count(*)::int FROM onboarding_selected_categories),
       (CASE WHEN (SELECT count(*) FROM onboarding_selected_categories) = 1 THEN 'PASS' ELSE 'FAIL' END);

RESET ROLE;

-- ── 5. As user B (symmetric) ──
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', auth_user_id::text)::text,
  true
) FROM rls_users WHERE email = 'rls_test_b@example.invalid';
SET LOCAL ROLE authenticated;

INSERT INTO rls_results
SELECT 'B: current_anon_id matches profile',
       1,
       (CASE WHEN current_anon_id() = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid') THEN 1 ELSE 0 END),
       (CASE WHEN current_anon_id() = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid') THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: journal_entries visible = 1',
       1,
       (SELECT count(*)::int FROM journal_entries),
       (CASE WHEN (SELECT count(*) FROM journal_entries) = 1 THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: journal_entries leakage of A = 0',
       0,
       (SELECT count(*)::int FROM journal_entries
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM journal_entries
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: journal_entry_fields visible = 1 (join policy)',
       1,
       (SELECT count(*)::int FROM journal_entry_fields),
       (CASE WHEN (SELECT count(*) FROM journal_entry_fields) = 1 THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: onboarding_states visible = 1',
       1,
       (SELECT count(*)::int FROM onboarding_states),
       (CASE WHEN (SELECT count(*) FROM onboarding_states) = 1 THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: onboarding_selected_categories visible = 1 (join policy)',
       1,
       (SELECT count(*)::int FROM onboarding_selected_categories),
       (CASE WHEN (SELECT count(*) FROM onboarding_selected_categories) = 1 THEN 'PASS' ELSE 'FAIL' END);

RESET ROLE;

-- ── 6. Report ──
SELECT * FROM rls_results ORDER BY status DESC, assertion;

\echo
\echo 'Expected: every row status = PASS. Any FAIL means RLS isolation is broken — do not ship.'

ROLLBACK;
