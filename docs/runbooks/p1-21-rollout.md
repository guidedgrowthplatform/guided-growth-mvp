# P1-21 Anonymization Rollout

## What this changes

Adds `profiles.anon_id` to split user identity from behavioral data across 15 tables. A `current_anon_id()` SECURITY DEFINER helper drives RLS so policies resolve the caller's anon_id without exposing `auth.uid()` to behavior tables. The admin `/api/admin/users/:id/data` endpoint is now audit-logged.

## Pre-flight (before apply)

1. Confirm a low-traffic window. The Phase 2 code in this branch unconditionally reads `profiles.anon_id`; a mismatched deploy ↔ migration order will 5xx until both sides line up.
2. Take a Supabase snapshot/backup.
3. Run `scripts/audit-anon-id-orphans.sql` against the target DB. Expect 0 orphans in every table. If any count is > 0, STOP — investigate and clean before proceeding. Orphan rows will abort the migration's `SET NOT NULL` step.

## Apply

1. Apply `supabase/migrations/025_anon_id.sql` in a single psql session. The migration is wrapped in `BEGIN`/`COMMIT` — any failure rolls back atomically.
2. Run `scripts/validate-anon-id-backfill.sql`. Expect zero NULLs and zero FK violations across all 15 tables.

## Code cutover

1. Promote the Vercel build from `feat/p1-21-anonymization`.
2. A brief 5xx window (~seconds) is expected during function cutover and is acceptable at MVP scale.
3. Watch Sentry for `[auth] profile row missing for authenticated user` warnings — should be zero.
4. Smoke test: signup → onboarding → home → create journal entry → check-in → admin user-data lookup. Verify the admin call writes a row in `admin_audit_log` with `action = 'read_user_data'`.

## Rollback

- **Apply failed:** `BEGIN`/`COMMIT` rolled back atomically. Investigate the error and re-run.
- **Apply succeeded, code is broken:** rollback Vercel to the previous deployment. Note that previous deploys read `user_id` columns which no longer exist, so they will 5xx until either (a) the new code is re-deployed or (b) `025_anon_id_down.sql` is applied.
- `025_anon_id_down.sql` exists for emergency revert. Test on staging before considering for prod — it is a destructive reversal.

## T2.2 — Migration 026 rollout (JWT claim injection)

### Pre-flight

1. Confirm migration 025 is applied (`profiles.anon_id` must exist).
2. Visit Supabase Studio → Authentication → Hooks. Confirm `custom_access_token_hook` is enabled and points to `public.custom_access_token_hook`. The migration replaces the function body in place; the dashboard wiring is unaffected. Verify before apply in case it was toggled off.

### Apply

1. Apply `supabase/migrations/026_inject_anon_id_to_jwt.sql` in a single psql session. Single `BEGIN`/`COMMIT`.
2. Sign out + sign back in once on staging. Decode the resulting JWT on jwt.io → confirm `anon_id` and (if the profile has a name) `first_name` claims are present.

### Code cutover

1. Promote the Vercel build from `feat/p1-21-mr-b-jwt-tests`.
2. Watch Sentry / logs for `[auth] legacy token, fell back to profiles SELECT` info entries. Volume tapers as users rotate tokens (~1h default lifetime).
3. Sanity-check hot-path latency (`/api/session_log`, `/api/llm`, `/api/entries`) — p50/p95 should drop one DB round-trip's worth.

### Fallback removal (follow-up MR, after 24h)

Once the fallback info line has been silent for a full token-lifetime window, open a small MR that deletes `fetchClaimsFromDb` and the info log, making the JWT path mandatory.

### Rollback

Apply `supabase/migrations/026_inject_anon_id_to_jwt_down.sql`. The previous code still works against the down-migrated hook because `readClaimsFromJwt` returns null → falls back to DB.

## RLS isolation test (operator-run)

`psql "$DATABASE_URL" -f scripts/test-anon-id-rls.sql` against a local Supabase test DB. The script seeds two users, exercises `current_anon_id()` and the join-via-parent policies, and rolls back at the end. Every assertion must report PASS. Requires at least one row in `categories` (run after the standard category seed).

## Out of scope (follow-up MRs)

- API response `anon_id AS user_id` alias rename (`api/reflections/[...path].ts`, `api/onboarding/[...path].ts`).
- Delete `/api/me` once frontend reads anon_id from `session.user.app_metadata` directly (after migration 026 is applied and stable).
- CI integration for `scripts/test-anon-id-rls.sql`.
- Moving `custom_access_token_hook` wiring into `supabase/config.toml`.
