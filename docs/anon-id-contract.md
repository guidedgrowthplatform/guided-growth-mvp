# anon_id contract for behavioral data

Status: contract doc for #89. Defines the single identity key for all behavioral data so new code
does not drift back to `user_id`. Written from the live implementation as of 2026-06-05.

## The rule

**All behavioral data is keyed by `anon_id`, never by `user_id` / `auth.users.id`.**

`anon_id` is the stable, pseudonymous behavioral identity. `user_id` (the Supabase auth user id) is
PII-adjacent account identity and is used only for auth, billing, and encryption key derivation, not
for behavioral attribution. Keeping behavior on `anon_id` lets the same person be tracked
consistently across web and mobile and keeps analytics decoupled from account identity.

## Where anon_id comes from (source of truth)

`anon_id` is a **claim on the Supabase access token (JWT)**, minted in the auth layer. It is the
same value on web and mobile once #98 / #46 land (mobile mints the same anon_id as web).

- Client read: `src/stores/authStore.ts` `fetchAnonId()` decodes the JWT (`claims.anon_id`) and
  stores it in `authStore.anonId`. Missing claim is reported to Sentry as
  `analytics_identify_failed` / `missing_anon_id_claim`.
- Client use: `getCurrentAnonId()` in `src/lib/services/supabase-data-service.ts` reads
  `authStore.anonId` and throws if unauthenticated. Every data-service write uses it.
- Server read: `api/_lib/auth.ts` `requireUser()` resolves `anon_id` from the profile table and
  returns `user.anonId`. Handlers call `setUserContext(user.anonId)` and scope every query
  `WHERE anon_id = $1`. The server never trusts a client-supplied anon_id for writes.

## Do

- Read identity from `getCurrentAnonId()` (client) or `requireUser(req,res).anonId` (server).
- Key every behavioral table on `anon_id` and scope reads/writes to the authenticated anon_id.
- Pass `anon_id` (not `user_id`) into Vapi tool-call arguments and any LLM context.
- Use `anon_id` as the PostHog `distinct_id` (`identify(anonId)`).

## Don't

- Do not use `auth.users.id` / `user.id` / `user_id` to key, filter, or attribute behavioral data.
  `getCurrentAuthUserId()` exists only for pre-025 ciphertext key derivation, not for behavior.
- Do not accept a client-supplied anon_id on a write; always resolve it server-side from the token.
- Do not call `posthog.identify()` with anything other than `anon_id`.

## How to add a new behavioral table

1. Add an `anon_id text not null` column; index it; add an RLS policy scoping rows to the
   authenticated anon_id (see existing `daily_checkins`, `reflections`, `journal_entries`).
2. On the server, resolve `requireUser(req,res).anonId`, call `setUserContext(anonId)`, and write
   `WHERE anon_id = $1` / `INSERT ... (anon_id, ...)`.
3. On the client, write through the data service using `getCurrentAnonId()`; never a raw fetch with
   a hand-passed id.
4. For analytics on the new table, emit PostHog events while identified as `anon_id`.

## Current implementation state (verified)

| Surface | Uses anon_id? | Where |
|---------|---------------|-------|
| Data service writes (checkins, reflections, journal, habits) | yes | `getCurrentAnonId()` + `WHERE anon_id` |
| Backend API auth/scope | yes | `requireUser().anonId` + `setUserContext` |
| PostHog identify | yes (`distinct_id = anon_id`) | `src/stores/authStore.ts` `callIdentify` -> `src/analytics/posthog.ts` |
| Vapi tool calls | yes (`args.anon_id`) | `api/vapi/[...path].ts` |
| Sentry user | anon_id | `Sentry.setUser({ id: anonId })` |

Open dependency: web/mobile anon_id parity is completed by #98 (bundle anon_id generation into the
auth fix) so mobile emits the same anon_id as web. Until then, mobile may mint a divergent id.

## Code-review checklist (flag on review)

- New behavioral column keyed on `user_id` instead of `anon_id` -> reject.
- `posthog.identify(...)` or `distinct_id` set to anything but `anon_id` -> reject.
- A write handler that reads an anon_id from the request body instead of `requireUser().anonId`
  -> reject.
- Vapi tool handler or LLM context passing `user_id` for behavior -> reject.
