# Loop 6 fix report - QA control screen audit (B1 remainder + B22)

Branch `bugfix-loop6-qa-audit` off origin/staging 9526b377. Plan: gg-spec
`docs/onboarding-bugfix-plan-2026-07-02.md`, Loop 6. The one-tap-fresh tile
launch (c8f85490) and the B17 thread-clear + hard-reload (MR !400) are NOT
redone here; rows below reference them where they apply.

## The audit table (button -> claimed -> actual -> verdict)

Code-read on staging 9526b377; "preview" column filled after live verification
on this branch's deploy_qa_preview URL (see MR).

| # | Control | Claims | Actually does (staging, pre-fix) | Verdict / action |
|---|---|---|---|---|
| 1 | Test user dropdown | "the dropdown reflects the real accounts" (live list from /api/qa/users, fallback static) | Endpoint verified healthy on staging previews now (200: Fable, Mintesnot). The worklog's "/api/qa/users 500s on both previews" observation is STALE - that was the pre-env-flip state. Fallback list contained five prod-era accounts, none of which exist on staging, so an endpoint outage would leave only sign-in-failing picks | Fixed (minor): fallback list now leads with the two accounts that exist on staging (Fable, Mintesnot); prod-era names kept behind them |
| 2 | Tile "Full onboarding" - "Fresh run from auth" | Sign in as picked user, wipe server rows, navigate /onboarding/flow | Wipe works. The launch can still not LOOK fresh for the known reasons: B17 stale thread (owned by MR !400) and B9 resume (owned by MR !398) - both out of scope here. NEW latent bug B22 found while auditing the launch path: react-query gate/resume cache survives a user switch (see fix 1); latent today because every entry to the launcher is a fresh page load, but armed by any multi-action visit (including this MR's stay-put reset) or future SPA entry | Fixed (B22, defensive): queryClient.clear() before navigation. Composes with !400's hard reload |
| 3 | Tile "Profile start" - "Skip auth, start at profile beat" | ?startAt=profile fast-forwards auth+mic with empty captures; user already signed in via ensureSignedIn | Mechanism real on staging (FlowOnboarding reads startAt; fastForwardToNode walks pre-fork nodes deterministically). Same B22 caveat as row 2 | True after fix 1; verified on preview |
| 4 | Tile "Mic + Profile" - "Start at mic permission, then profile" | ?startAt=mic stops the seed walk at the mic node | Same as row 3, one hop earlier | True after fix 1; verified on preview |
| 5 | Tile "Home tour" - "Post-onboarding app tour", tagged "partial" | Navigates /flow-preview/home-tour; 'home-tour' componentType absent from componentRegistry | Honest: the tile itself declares "partial" and the hint line explains. But launching it WIPED the picked user's server data for nothing (in-memory preview, see fix 2) | Fixed (fix 2): preview tiles no longer self-reset |
| 6 | Tile "Morning check-in" - "4-beat morning state-check flow" | Navigates /flow-preview/morning-checkin | Beat count TRUE (4 nodes: greeting, state, are-you-done, wrap). All componentTypes registered. But the launch wiped the picked user's server data and the in-memory preview never reads it - a destructive no-op (a tester "just looking at the morning flow" silently destroys the selected account's data) | Fixed (fix 2) |
| 7 | Tile "Evening check-in" - "5-beat evening flow" | Navigates /flow-preview/evening-checkin | Beat count TRUE (5 nodes). HabitReviewAdapter reads in-memory answers with a static sample fallback - confirmed no server reads, so the wipe changes nothing on screen | Fixed (fix 2) |
| 8 | Button "Log in" - "Sign in and go to where this user left off." | Signed in, then navigated to the SELECTED FLOW's route. With "Evening check-in" selected, "where this user left off" opened an in-memory evening preview | Fixed (fix 3): navigate('/') and let AppGate route for real (onboarded -> home, in-progress -> onboarding resume). Now does exactly what the label says |
| 9 | Button "Restart onboarding (fresh)" - "run onboarding from the top" | Ran the SELECTED flow after the wipe: with a check-in flow selected it wiped data then opened a preview, no onboarding anywhere | Fixed (fix 4): always launches full onboarding (label-true). Per-flow fresh launches are the tiles themselves (c8f85490) |
| 10 | Button "Re-run onboarding (keep data)" - "Go through onboarding again with the data already saved." | For a COMPLETED user: AppGate sees status ready and bounces /onboarding/flow to home - the button did nothing it claims. For an in-progress user: plain resume, not a re-run | Fixed (fix 5): converted to "Replay flow (preview)" -> /onboarding-flow-preview (auth-free, outside AppGate, in-memory persistence). Runnable from the top for everyone, saved data untouched. The old promise (real re-run keeping server data) is not implementable without fighting AppGate and Loop 2's resume; if product wants it, that is a spec question for Yair |
| 11 | Button "Reset data only" - "Wipe this user data, keep the account. No onboarding." | navigate('/') after the wipe -> AppGate sees onboarding_needed -> redirects INTO onboarding. The one thing the label rules out is exactly where you land | Fixed (fix 6): stays on the QA screen, shows a green confirmation line, busy cleared. Wipe itself verified transactional and correctly scoped (api/qa/self-reset: QA-pattern-gated, per-anon_id deletes + profile onboarding-field nulls) |
| 12 | Error line | Shows action errors | Works (setError in run's catch) | Unchanged; green notice line added next to it for fix 6 |
| 13 | Launch voice default | (Loop 6 requirement: launches start with coach voice ON) | Voice preference default is B2, fixed on MR !398 (voice forced ON at flow mount), unmerged | NOT reimplemented here per the plan ("do not implement a second default-ON mechanism"). Until !398 merges, launches from this branch still start with voice OFF |

## Fix 1 - B22 (new bug, latent): stale react-query cache across QA user switch

**What broke.** `useAppGate` caches the onboarding row under a global (not
per-user) query key with `staleTime: Infinity, gcTime: Infinity`. The only
cache clear in the app is in `authStore.signOut`. The QA screen switches users
via `signIn` WITHOUT sign-out, and wipes rows server-side without touching the
client cache. In a warm heap, launches would be gated and resumed against the
previous user's (or the pre-wipe) row: a cached "completed" row bounces a
fresh-run launch to home; a cached in-progress row lets the resume walk land
mid-flow on a supposedly fresh run.

**Why latent (honest scoping).** Verified by search: NO in-SPA path enters
/onboarding/qa today. QAFab signs out (which clears the cache) and does a full
page load; tile launches navigate with replace:true so browser-back skips the
launcher; direct URL entry is a fresh heap. So the visible B1 "looked broken"
residue stays attributed to B17/B9 as the ledger says - this cache bug has NOT
been firing. It arms the moment anything keeps the heap warm across actions:
this MR's stay-put reset (fix 6) is exactly such a sequence, the pre-existing
error-retry path is another, and any future SPA link to the launcher would be
a third. Fixing it now is a prerequisite of fix 6, not gold-plating.

**The fix.** `queryClient.clear()` in `run()` after sign-in and any wipe,
before every navigation. Cheap and total: every user-scoped query (gate,
habits, entries) is wrong after a user switch, so clearing all of it is the
correct primitive, mirroring what signOut already does.

**Upstream prevention.** Any future surface that switches Supabase sessions
without signOut MUST clear the query cache; the root cause is that session
switching is not a first-class operation in authStore. Suggested follow-up
(not in this MR, authStore is shared surface): fold "switch user" into
authStore as signIn + queryClient.clear() so callers cannot forget.

**Interplay with !400.** !400's hard page load on restart/reset also empties
the in-memory query cache on those two paths; this fix additionally covers the
SPA-navigated paths (login, replay) and makes the intent explicit. Both MRs
edit `run()`; a small textual conflict is expected at merge - resolution is
additive (keep clearThread + hard navigation from !400, keep kind-gating +
clear() + honest destinations from this branch).

## Fix 2: preview tiles wiped server data (destructive no-op)

**What broke.** c8f85490 made every tile launch "fresh" via `run('restart')`,
which self-resets before navigating. Correct for the three server-backed
launches; meaningless for home-tour / morning / evening, which render through
`FlowCheckinPreview`/`HomeTourPreview` with IN-MEMORY persistence and never
read the wiped rows. A tester who tapped "Evening check-in" silently destroyed
the picked account's onboarding data.

**The fix.** `FlowDef.kind: 'server' | 'preview'`; `run('restart')` only
self-resets for `kind === 'server'`.

**Upstream prevention.** The kind field now forces the launch semantics
decision whenever someone adds a tile; a new FlowDef without `kind` fails tsc.

## Fixes 3-6: claims aligned with behavior

Rationale per row in the table (rows 8-11). Common principle: after c8f85490
the tiles ARE the per-flow fresh launches, so each account-state button must
hold a distinct, label-true meaning: log in = real routing, restart = full
onboarding fresh, replay = preview walk, reset = wipe and stay.

## Out of scope / owned elsewhere

- B17 stale thread on restart: MR !400 (clearThread in selfReset + hard loads).
- B2 voice default ON: MR !398. Table row 13.
- B9/B10 resume correctness behind the "Full onboarding" tile: MR !398.
- /api/qa/users historical 500: stale observation, endpoint healthy on staging
  previews since the 2026-07-02 env flip; no code change needed.
