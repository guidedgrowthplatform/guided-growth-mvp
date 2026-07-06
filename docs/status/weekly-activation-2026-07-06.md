# The Weekly: activation status (2026-07-06)

Session: weekly activation (Yair ruled 2026-07-06: isolated internal testing goes live now).
Scope: QA surface only. Production paths untouched.

## Where things stand

| Piece                             | Status                                                                                                                                                                                              | Where                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Weekly code on main               | Already merged (via staging, before this session)                                                                                                                                                   | !422 is fully contained in main; recommend closing it |
| Phase 0 findings + corrections    | Posted                                                                                                                                                                                              | !422 notes 3693 and 3698                              |
| QA Vapi weekly assistant          | LIVE: 5 weekly\_\* tools + coaching prompt synced from the repo lockfile                                                                                                                            | Vapi QA account, assistant 6642a671                   |
| QA Vapi Coach Yair                | Reconciled: 15 tools (was 12), addendum applied, webhooks re-pointed to the staging-backed alias                                                                                                    | Vapi QA account, assistant 7af9d90a                   |
| Turn-taking ruling (QA account)   | Applied to both QA assistants: soniox v5, languages [en, he, es] kept, waitSeconds 0.7, onNoPunctuationSeconds 1.5, numWords 2, maxEndpointDelayMs 1500, gladia fallback, speaks-first, 48s silence | direct PATCH, documented in !451                      |
| Turn-taking ruling (PROD account) | Queued behind the first successful QA voice session (ruling says QA first)                                                                                                                          | same PATCH body, prepared                             |
| VITE_VAPI_WEEKLY_ASSISTANT_ID     | Set, preview scope only (all preview branches), value = QA assistant 6642a671                                                                                                                       | Vercel env                                            |
| Staging lockfile                  | Committed                                                                                                                                                                                           | MR !451 (draft)                                       |
| QA on-demand trigger              | Built: /weekly-session page + QA-screen tile, live Vapi session, beats driven by weekly_advance                                                                                                     | MR !454 (draft)                                       |
| Preset seed script                | Built: 10 presets, staging-only hard gate, 14 tests. NOT yet executed                                                                                                                               | MR !455 (draft)                                       |
| Acceptance voice session          | BLOCKED, see below                                                                                                                                                                                  |                                                       |

## THE one blocker: migration 055 on staging

`supabase/migrations/055_the_weekly.sql` is applied on PRODUCTION but NOT on staging
(`ppyouymvnrqxcsllrmsl`). Everything downstream needs it: `/api/weekly/context` reads
`reflection_settings.weekly_day`, `weekly_complete` writes `weekly_sessions`, and the seed
script writes both. This session's permission gate declined direct DDL against the shared
staging DB, so it needs a human:

1. Open the Supabase SQL editor for project `ppyouymvnrqxcsllrmsl` (guided-growth-staging).
2. Paste and run `supabase/migrations/055_the_weekly.sql` from main. It is idempotent
   (IF NOT EXISTS everywhere) and additive only.

After that lands, this session (or any operator) runs, in order:

1. The seed: `STAGING_SUPABASE_URL=… STAGING_SUPABASE_SERVICE_ROLE_KEY=… STAGING_DATABASE_URL=… QA_PASSWORD=… node scripts/qa/seed-weekly-presets.mjs` (QA_PASSWORD must equal the QA surface's VITE_QA_PASSWORD so the picker login works). The script proves its target before writing and refuses anything that is not the staging ref.
2. The acceptance session: preview deploy of !454, sign in as `qa-weekly-2w-mixed@guidedgrowth.test` (or any preset), QA screen, The Weekly tile, Start session, talk the 5 beats, verify `weekly_sessions` + habit edits in staging tables, post evidence on the MR.
3. The PROD Vapi turn-taking PATCH (after the QA session sounds right).

## Decisions for Yair (found while reconciling, not covered by any ruling)

1. Model tier: both weekly assistants run gpt-4o-mini. The Weekly is the richest generative
   session in the product. Recommendation: gpt-4o for the weekly assistants; cost impact is
   one session per user per week.
2. Coach Yair persona prompt drift: PROD (20.6k chars) is newer than QA (18.9k). The lockfile
   manages only the tool addendum block, not the persona. Recommendation: copy the PROD persona
   to the QA assistant, and consider making the persona lockfile-managed so this cannot drift again.
3. QA Coach Yair had no voice fallbackPlan (PROD has an 11labs fallback). The weekly QA
   assistant got the PROD voice config mirrored (including fallback); Coach Yair QA still has
   none. Recommendation: mirror it.

## Vapi accounts, for the record

- QA account: Coach Yair 7af9d90a, Coach Yair - Weekly 6642a671. Tools point at the staging
  branch alias (staging DB, secret verified matching).
- PROD account: Coach Yair 1272f6ba, Coach Yair - Weekly ca479cf5. Untouched this session.
  Note: any future re-sync of PROD tools needs the real prod webhook secret first (the local
  .env.local value does NOT match prod; verified by probe). Prod tools are lockfile-current
  from 2026-07-04, so nothing forces that.
- The brief's assistant id ca479cf5 is the PROD weekly assistant; per conductor correction it
  was not used for QA.

## Budget

Voice checks used: 0 of 6. The acceptance session will be the first.
