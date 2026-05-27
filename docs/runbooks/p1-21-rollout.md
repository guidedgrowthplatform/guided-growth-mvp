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
- **Apply succeeded, code is broken:** rollback Vercel to the previous deployment. Note that previous deploys read `user_id` columns which no longer exist, so they will 5xx until the new code is re-deployed. Forward-fix is the standard rollout strategy.
- **Emergency schema revert** (last resort, destructive — restores `user_id` columns across session_log, feedback, affirmations, entries, and pre-025 RLS policies): recover the reversal SQL from git history at `git show bb0c3fb:supabase/migrations/025_anon_id_down.sql`. Test on staging before considering for prod. Any rows added after 025 cannot be undone — they'll be dropped along with `anon_id`.

## Out of scope (follow-up MRs)

- PostHog `identifyUser` regression (`src/stores/authStore.ts`).
- `requireUser()` N+1 round-trip (`api/_lib/auth.ts`).
- `/api/me` trim (`api/me.ts`).
- Delete-account loop cleanup (`api/onboarding/[...path].ts`).
- API response `anon_id AS user_id` alias rename.
