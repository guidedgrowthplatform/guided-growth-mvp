# Fix report: Vapi cap revert + onboarding exemption, release-prep verification

Date: 2026-07-05. Branch: `fix/vapi-cap-revert-onboarding-exemption`. MR: !431 (draft).
Anchor items A6 (cap), A4 (real-signup e2e), A5 (day-one) from `gg-spec/docs/fable-lane-anchor-demo-2026-07-03.md`.
Surfaces used: QA/staging only (gg-qa-iota.vercel.app, QA Supabase `ppyouymvnrqxcsllrmsl`). No production config touched. Not merged (conductor merges after review).

## 1. Code change (A6)

- `src/lib/config/voice.ts`: `VAPI_DAILY_CAP` default `25 -> 5` (gg-spec UX-12). Added `CAP_EXEMPT_PAYLOAD_KEY`; `countVapiToday` now skips `payload.cap_exempt === true`.
- `src/hooks/useRealtimeVoice.ts`: onboarding realtime-voice `voice_started` events tagged `cap_exempt: true` (single Vapi call site, onboarding-only).
- `src/lib/config/__tests__/voice.test.ts` (new): locks the reverted default and the exemption.

Local gate (worktree, node_modules from the lockfile-identical `ggmvp-the-weekly`):
- `npm run type-check` (tsc --noEmit): clean.
- `eslint` on the 3 changed files: clean.
- `vitest run` voice.test.ts + vapiLiveGate.test.ts: 11/11 pass.

## 2. Server-side backstop (A6): analysis + gap

Detailed in the MR description. Summary:
- The counted (non-exempt) cap is already server-durable via existing 24h hydration (`SessionLogProvider` hydrates the last 24h of `session_log` from `/api/context/state`, cap recomputes on hydrate), so for a signed-in user with a persistent `anon_id` the counted cap survives a localStorage wipe.
- No un-bypassable hard block is feasible in-window: the client starts Vapi directly with a public key (`VITE_VAPI_PUBLIC_KEY` + `VITE_VAPI_ASSISTANT_ID`); there is no server endpoint that mints the Vapi session, so no pre-spend chokepoint exists, and with onboarding now cap-exempt an abusive onboarding loop is not bounded by the client cap.
- Proposal (NEEDS-YAIR, follow-up): a hard Vapi-dashboard per-day/concurrency ceiling (infra), and/or a pre-call `/api/voice/authorize` chokepoint with a calibrated per-`anon_id` ceiling that does not break a single legitimate onboarding.

## 3. Real signup end to end (A4): PASS

Method: the app's own Supabase auth calls, run against the QA Supabase (`ppyouymvnrqxcsllrmsl.supabase.co`, public anon key from the deployed bundle), with a fresh readable disposable inbox `ggqafable705@mailinator.com` (fresh, real-pattern, external, not a qa-onboarding test fixture).

| Step | Result |
|---|---|
| Signup (`POST /auth/v1/signup`) | HTTP 200, `role: authenticated`, `confirmation_sent_at` set, no session returned. Matches the app's `signUp` contract (it rejects auto-confirmed sessions and returns `confirmationPending`). |
| Email delivery | Confirmation email received in the inbox within ~1 min, from `no-reply@mail.guidedgrowthapp.com` (custom SMTP, so external delivery works), subject "Confirm your email address". |
| Confirm link | `GET /auth/v1/verify?type=signup&token=...` returned HTTP 303 to the QA site with `access_token` + `refresh_token`. Decoded token: `email_verified: true`, `anon_id` present in claims (`df533318-...`). |
| First sign-in | `POST /auth/v1/token?grant_type=password` HTTP 200, `access_token` present, `email_confirmed_at` set. Confirmed email -> sign-in works. |
| Password reset | `POST /auth/v1/recover` HTTP 200; "Reset your password" email received in the inbox. |
| anon_id hydration fix present in build | Yes. `src/stores/authStore.ts` (lines ~80-105) reads `claims.anon_id` and falls back to the profile's `anon_id` when the claim is missing (logs `missing_anon_id_claim`). Consistent with the live token carrying `anon_id`. |

## 4. Post-onboarding day one (A5): PARTIAL, verified surfaces below

Method: QA Control screen (`/onboarding/qa`, the intended launcher) with the Fable test user, Vapi OFF throughout.

| Sub-item | Result |
|---|---|
| Onboarding reachable + progresses | Yes. "Get started" launches the flow; "Log in" resumes the Fable user at the Profile beat; the tap path works (age dropdown + gender radios + Continue advance the beat). |
| Morning check-in reachable | Yes. QA launcher opens `/flow-preview/morning-checkin`, coach renders "Good morning. Ready to check in?" |
| Evening check-in reachable | Yes. QA launcher opens `/flow-preview/evening-checkin`, coach renders "Hey, good evening." |
| Home reflects chosen habits | NOT verified in-session. Requires a completed-onboarding account with habits; the Fable test user was mid-onboarding and a full manual onboarding-to-home walk was not completed (long multi-beat flow + intermittent tooling). Reserved for Yair's real-phone walkthrough (already a NEEDS-YAIR in the lane doc A5). |

Caveat: the check-in flows were reached via the QA `/flow-preview/*` routes (the launcher's preview surfaces), which confirms the flows render and are reachable; a full complete-through-submit run of each check-in on the live post-onboarding surface is part of the same real-phone walkthrough.

## 5. NEEDS-YAIR

1. Un-bypassable voice-spend ceiling: set a hard Vapi-dashboard daily/concurrency limit (infra), and decide whether to add the `/api/voice/authorize` pre-call chokepoint with a calibrated onboarding-safe ceiling.
2. Confirm the intended cap semantics: with onboarding exempt and Vapi onboarding-only today, the 5/day cap's practical bite is currently small (forward-looking for coach/returning-user voice on the counted path).
3. Real-phone walkthrough (lane doc A5): complete a fresh account through onboarding to a home that reflects chosen habits, and complete each check-in end to end on the live surface.
