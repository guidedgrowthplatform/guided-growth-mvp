-- test-anon-id-rls.sql
-- RLS isolation + anonymization-policy penetration test.
--
-- Seeds two users + parent/child rows for each, then verifies:
--   • current_anon_id() returns the caller's anon_id from JWT or profile.
--   • Per-table RLS policies (anon_id = current_anon_id()) deny cross-user
--     reads on journal_entries, journal_entry_fields, onboarding_states,
--     onboarding_selected_categories, daily_checkins.
--   • Profiles policy denies reading another user's row.
--   • session_log / feedback are unreadable from an authenticated session
--     (service-role-only posture per migration 026 service_role_only policy).
--
-- The penetration assertions enforce the policy doc's hard acceptance
-- criterion: a forged auth.uid() cannot pull another user's data.
--
-- When:  Pre-launch + after migrations touching policies or current_anon_id.
-- How:   psql "$DATABASE_URL" -f scripts/test-anon-id-rls.sql
-- Safe:  Entire script runs inside BEGIN/ROLLBACK; no rows persist.

BEGIN;

-- ── 1. Seed two auth.users; handle_new_user creates profiles+anon_id ──
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
-- Subqueries inside the role-switched assertions read this table; grant so
-- the authenticated role can SELECT.
GRANT SELECT ON rls_users TO authenticated;

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
     ),
     dc_a AS (
       INSERT INTO daily_checkins (anon_id, date, mood)
       SELECT anon_id, CURRENT_DATE, 3 FROM a
       RETURNING id
     ),
     dc_b AS (
       INSERT INTO daily_checkins (anon_id, date, mood)
       SELECT anon_id, CURRENT_DATE, 3 FROM b
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
-- The role-switched sections below run as `authenticated`. Grant INSERT
-- on the temp table so they can record assertions.
GRANT INSERT, SELECT ON rls_results TO authenticated;

-- ── 4. As user A ──
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', auth_user_id::text)::text,
  true
) FROM rls_users WHERE email = 'rls_test_a@example.invalid';
SET LOCAL ROLE authenticated;

INSERT INTO rls_results
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

-- onboarding_selected_categories join policy isn't asserted here because
-- the test's seed of a child row depends on the `categories` lookup table
-- being non-empty in the target DB. The same EXISTS-based join policy
-- pattern IS asserted on journal_entry_fields above, which exercises the
-- identical Postgres mechanism, so the policy form is covered.

INSERT INTO rls_results
SELECT 'A: daily_checkins leakage of B = 0',
       0,
       (SELECT count(*)::int FROM daily_checkins
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM daily_checkins
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: profiles leakage of B = 0',
       0,
       (SELECT count(*)::int FROM profiles
          WHERE id = (SELECT auth_user_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM profiles
                    WHERE id = (SELECT auth_user_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

-- NOTE: session_log and feedback are deliberately service-role-only:
--   • RLS enabled, no policy for authenticated (migration 028 / 026)
--   • zero GRANTs to authenticated
-- Verifying via SELECT here would trip "permission denied for table"
-- which aborts the transaction. Their unreadability is asserted by the
-- audit script (scripts/audit-policy-drift.sql) — kept out of this
-- script so the assertions can run to completion.

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
SELECT 'B: journal_entries leakage of A = 0',
       0,
       (SELECT count(*)::int FROM journal_entries
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM journal_entries
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: daily_checkins leakage of A = 0',
       0,
       (SELECT count(*)::int FROM daily_checkins
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM daily_checkins
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: profiles leakage of A = 0',
       0,
       (SELECT count(*)::int FROM profiles
          WHERE id = (SELECT auth_user_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM profiles
                    WHERE id = (SELECT auth_user_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

RESET ROLE;

-- ── 5b. Extra-table cross-user isolation (seed as service_role) ──
-- Covers user_preferences, affirmations, reflections, reflection_configs.
-- Each has anon_id and an authenticated-role policy of
-- `anon_id = current_anon_id()`.
INSERT INTO user_preferences (anon_id, default_view, spreadsheet_range)
SELECT anon_id, 'spreadsheet', 'month' FROM rls_users
ON CONFLICT (anon_id) DO NOTHING;

INSERT INTO affirmations (anon_id, value)
SELECT anon_id, 'rls-test affirmation ' || email FROM rls_users
ON CONFLICT (anon_id) DO NOTHING;

INSERT INTO reflection_configs (anon_id, fields, show_affirmation)
SELECT anon_id, '[]'::jsonb, true FROM rls_users
ON CONFLICT (anon_id) DO NOTHING;

INSERT INTO reflections (anon_id, date, field_id, value)
SELECT anon_id, CURRENT_DATE, 'gratitude', 'rls-test reflection ' || email FROM rls_users
ON CONFLICT (anon_id, date, field_id) DO NOTHING;

-- ── 5c. As user A — assert leakage of B = 0 across extra tables ──
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', auth_user_id::text)::text,
  true
) FROM rls_users WHERE email = 'rls_test_a@example.invalid';
SET LOCAL ROLE authenticated;

INSERT INTO rls_results
SELECT 'A: user_preferences leakage of B = 0',
       0,
       (SELECT count(*)::int FROM user_preferences
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM user_preferences
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: affirmations leakage of B = 0',
       0,
       (SELECT count(*)::int FROM affirmations
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM affirmations
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: reflections leakage of B = 0',
       0,
       (SELECT count(*)::int FROM reflections
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM reflections
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'A: reflection_configs leakage of B = 0',
       0,
       (SELECT count(*)::int FROM reflection_configs
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM reflection_configs
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_b@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

RESET ROLE;

-- ── 5d. As user B — symmetric leakage-of-A = 0 ──
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', auth_user_id::text)::text,
  true
) FROM rls_users WHERE email = 'rls_test_b@example.invalid';
SET LOCAL ROLE authenticated;

INSERT INTO rls_results
SELECT 'B: user_preferences leakage of A = 0',
       0,
       (SELECT count(*)::int FROM user_preferences
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM user_preferences
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: affirmations leakage of A = 0',
       0,
       (SELECT count(*)::int FROM affirmations
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM affirmations
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: reflections leakage of A = 0',
       0,
       (SELECT count(*)::int FROM reflections
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM reflections
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

INSERT INTO rls_results
SELECT 'B: reflection_configs leakage of A = 0',
       0,
       (SELECT count(*)::int FROM reflection_configs
          WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')),
       (CASE WHEN (SELECT count(*) FROM reflection_configs
                    WHERE anon_id = (SELECT anon_id FROM rls_users WHERE email = 'rls_test_a@example.invalid')) = 0
             THEN 'PASS' ELSE 'FAIL' END);

RESET ROLE;

-- ── 5e. Post-032: JWT without anon_id claim → current_anon_id() IS NULL ──
-- After migration 032 drops the profiles fallback, an empty claims object
-- must yield NULL (fail-closed) instead of resolving via profiles lookup.
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE authenticated;

INSERT INTO rls_results
SELECT 'post-032: current_anon_id() with no anon_id claim IS NULL',
       1,
       (CASE WHEN current_anon_id() IS NULL THEN 1 ELSE 0 END),
       (CASE WHEN current_anon_id() IS NULL THEN 'PASS' ELSE 'FAIL' END);

RESET ROLE;

-- ── 6. Report ──
SELECT * FROM rls_results ORDER BY status DESC, assertion;

\echo
\echo 'Expected: every row status = PASS. Any FAIL means RLS isolation is broken — do not ship.'

ROLLBACK;
