# Onboarding bugfix status — plan of 2026-07-02

Source ledger: `gg-spec/docs/onboarding-bugfix-plan-2026-07-02.md`. One row per bug ID.
Statuses: `open` / `in-progress` / `solved` / `blocked` / `merged-into-other`.
Updated the moment a status changes; this branch (`bugfix-status-2026-07-02`) is the single source of truth.

| ID | Bug | Loop | Status | MR | Notes |
|---|---|---|---|---|---|
| B1 | QA control: "Full onboarding" didn't start from beginning | 6 | partially solved | — | c8f85490 one-tap-fresh verified live 2026-07-02; remainder = QA screen audit (Loop 6) + downstream B17/B9 |
| B2 | Coach voice toggle OFF after refresh; must start ON | 2 | fix-implemented, preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | forced ON once per flow mount; stored pref can hold 'screen' from home Talk-instead |
| B3 | Cartesia opener silent while captions render | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | root cause: NO player existed for engine=cartesia beats in the flow renderer; new useBeatOpenerCartesia wraps speakOpener |
| B4 | MP3 clips don't play; dead air + long LLM think after path answer | 1 | fix-implemented (playback facet), preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | autoplay-rejection now defers to next gesture; dead-air facet is NOT playback — cross-filed to Loop 3 (B11 LLM stall) + Loop 2 (B20 wiring) |
| B5 | Age + gender prompts merged into one bubble | 4 | open | — | |
| B6 | Chat bubbles disappear randomly | 4 | open | — | |
| B7 | Profile card disappears after age + gender given | 4 | open | — | |
| B8 | "You're signed in" banner shows during onboarding | 2 | fix-implemented, preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | passed auth beat renders nothing in the timeline |
| B9 | Refresh mid-onboarding lands on wrong component + injects extras | 2 | fix-implemented (evidence-driven resume), preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | resumeFromServerRow stops at first beat missing its data fingerprint; refresh-matrix test derived from generated flow |
| B10 | Flow jumped welcome → profile, skipping in-between beat | 2 | fix-implemented (same resume rewrite), preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | numeric step 2 no longer catapults past pre-fork beats (regression test in) |
| B11 | LLM calls fail repeatedly; flow wedged at habit render | 3 | open | — | |
| B12 | LLM invents process talk ("confirm your path choice") | 3 | open | — | likely falls out of Loop 2 map fix |
| B13 | (folded into B4) | — | merged-into-other | — | |
| B14 | First spoken word cut off at clip start | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | first play gated on canplaythrough (2.5s bound); USER-first-word STT variant lives on feat/onboarding-voice-track1 → Loop 5 |
| B15 | Clips not pre-buffered; start rides the network | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | openerPreloadPool warms all clips at flow mount |
| B16 | Mic not armed early / not opened at clip end | 5 | open | — | needs Loops 1+2 |
| B17 | QA "Restart fresh" renders old chat thread (client cache not cleared) | 4 | open | — | root cause verified: QAControlScreen restart path never clears thread store |
| B18 | Recurring staging build error re-merged by diverged branches | — | tracked-elsewhere | — | handled separately; Loop 3 rules it out before B11. **LEAD (found 2026-07-02):** origin/staging has a COMMITTED `node_modules` symlink (mode 120000) → `/Users/yairamsel/Developer/ggmvp-unified/node_modules` — a machine-local absolute path, dangling everywhere else, and exactly the kind of artifact diverged branches keep re-merging. Whoever owns B18 should delete it on staging and add a CI guard (`git ls-files node_modules` must be empty). |
| B19 | Loading bubble renders/sticks on some beats when loading transcript/components | 4 | open | — | live QA walkthrough 2026-07-02 pm |
| B20 | Voice check-in save acked by coach, but card never updates and next beat never loads | 2 | fix-implemented (fill: !396; completion: !398), preview verification pending | [!396](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/396) + [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | card fill lands in !396; beat completion + GREATEST bump + dead-air bump fix in !398 (stacked) |
| B21 | Completed subcategory beat removed from timeline; habit-selection + habit-schedule render simultaneously | 4 | open | — | removal = B6/B7 unmount class; double-render its own sequencing defect |

## WORKLOG (append-only, one line per event; newest last)

- 2026-07-02 14:29 EAT — resumed prior session's run in a fresh session (Fable, xhigh); state recovered from STATUS.md + branches + !397
- 2026-07-02 14:40 — Loop 2 restart: re-verified GREATEST pin (api/onboarding/[...path].ts:37) + non-monotonic persist order 1,6,7,8,2,3,4,5,5 in generated flow
- 2026-07-02 14:50 — found: recordCheckin DOES write data.stateCheck (V3 comment in serverCaptureForBeat is stale); every persist beat has a data fingerprint → evidence-driven resume is viable
- 2026-07-02 14:55 — found: post-fork optimistic bump in useChatToolEvents is a no-op under the GREATEST pin (target 3..6 < pinned 8) → "dead air after path answer" (B4 facet) mechanism confirmed
- 2026-07-02 15:18 — resumeFromServerRow (evidence-first walk + numeric back-nav stop for steps 2-5) committed with flow-derived refresh-matrix test; 27/27 flow tests green
- 2026-07-02 15:20 — draft MR !398 opened (bugfix-loop2-resume → staging); B9/B10 fix-implemented
- 2026-07-02 15:35 — operator update: plan v2.3; reviewed MR !396 (card-fill) → docs/fix-reports/mr396-review.md; verdict stack-on-it; B20 fill wiring covered there, beat-completion + post-fork bump + 4 maps remain Loop 2
- 2026-07-02 15:40 — Loop 2 stacked on feat/onboarding-coach-card-fill (merge, no force-push); !398 is merge-after-!396
- 2026-07-02 15:45 — worktree node_modules lost to the dangling-symlink dance (B18 landmine); reinstalling; !396 untracks the symlink for good
- 2026-07-02 16:05 — operator: Vercel SSO off for previews; both loop previews load (200) — Chrome extension still dead (2x timeout), switching to Playwright
- 2026-07-02 16:12 — RULE-4 SANITY FAILED: loop previews, gg-qa-iota AND prod all bundle the PROD Supabase ref; supabase-environments.md §4 confirms Preview-scope env still prod-pointed. Interactive preview QA forbidden (writes would land in prod DB). Asked for Vercel Preview env fix + .env.staging.local. Team's gg-qa-iota walkthroughs have been writing to prod
- 2026-07-02 15:55 — Loop 2 batch 2 committed (62343899): four maps on V3 scale + flow-derived parity test; B20 completion (BEAT_COMPLETING += record_checkin/submit_morning_checkin, handlers GREATEST-bump, strictly-increasing bump w/ tool-to-beat guard); B2 voice forced ON at flow mount; B8 auth receipt suppressed; !396 allowedTools union guard picked up. tsc clean, 1365/1365 tests, build OK

## Loop status

| Loop | Scope | Status | Branch | MR |
|---|---|---|---|---|
| 0 | Prior-fix archaeology | done | bugfix-status-2026-07-02 (docs/prior-fixes/) | — |
| 1 | B3 B4 B14 B15 | fixes implemented + tested; preview verification pending (blocker below) | bugfix-loop1-audio | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) |
| 2 | B9 B10 B2 B8 B20 | in-progress: resume rewrite committed (B9/B10); maps + B20 wiring + B2/B8 next | bugfix-loop2-resume | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) |
| 3 | B11 B12 | pending | — | — |
| 4 | B5 B6 B7 B17 | pending | — | — |
| 5 | B16 | pending (stacks on 1+2) | — | — |
| 6 | B1 remainder | pending | — | — |

## Session wrap 2026-07-02 ~14:45 EAT (operator asked to stop; resume from here)

**Loop 0 — DONE.** Three notes in `docs/prior-fixes/` (this branch). Headline: mic-arm +
first-word fixes already exist on `feat/onboarding-voice-track1` (8de9b66, beed650), unmerged.

**Loop 1 — fixes implemented + tested, awaiting preview verification.** Branch
`bugfix-loop1-audio`, draft MR !397, all pushed. Latest preview:
https://gg-kxtkk853f-guided-growths-projects.vercel.app (behind Vercel SSO — open from an
authenticated browser). NEXT STEP: on that preview run fresh + mid-refresh onboarding
passes with console open (temp diagnostics log `[useBeatOpenerMp3]`/`[opener]` lines),
confirm every opener audible incl. the Cartesia name greeting, first words complete,
Slow-3G start latency; then revert the temp diagnostics commit, undraft !397.

**Loop 2 — mid-investigation, no code yet.** Branch `bugfix-loop2-resume` pushed (empty, at
staging tip b49d4987). ROOT CAUSE OF B9 CONFIRMED (bigger than the plan's framing): V3
persist steps are non-monotonic vs flow order (pre-fork beats persist 6/7/8, post-fork 2–5)
AND the server pins `current_step = GREATEST(...)` (api/onboarding/[...path].ts:37). So
after state-check saves step 6, current_step ≥ 6 forever, and `resumeToServerStep`'s
numeric stop condition (`entryServerStep >= serverStep`) can never match a post-fork beat
(max entry 5) → every refresh post-state-check walks to the END. Numeric-scale resume is
unfixable post-state-check; resume must become identity/data-driven. NEXT STEP: (1) write
the parity/regression test first — derive resume targets + the four stale maps from the
generated flow and assert refresh-at-each-persist-step stops at the right beat (failing
today); (2) implement resume that maps current_step → target NODE explicitly (incl.
6→STATE-CHECK, 7→MORNING-SETUP, 8→BEGINNER-07) and, for the post-fork ambiguity under
GREATEST, falls back to first-beat-with-missing-data walk; (3) update the four stale maps
in the same MR (systemPromptAddendum step ladder, preconditions.ts V3 tail,
STEP_TO_SCREEN_ID in useOnboarding.ts:29, SCREEN_TO_STEP in onboardingStepBeats.ts) +
record_checkin/submit_morning_checkin in toolEventToVoiceActions + BEAT_COMPLETING_TOOLS
(B20); (4) voice default ON + signed-in banner removal; (5) run vapi reconcile tests.
Also found: generated flow is MISSING the COACH-GREETING beat the oracle expects (B10 lead).

**Loops 3–6 — not started.** Loop 3 evidence pending: Yonas said he'd paste the captured
failing habit-selection request body — NOT received before the stop; ask him for it.

**Worktrees:** gg-bugfix-loops (this status branch) · gg-loop1 · gg-loop2 · gg-flow-reference
(oracle, dev server on :5199, `/flow-standalone/`; deps installed with --ignore-scripts, the
supabase-cli postinstall download fails in this environment — reinstall the same way).
Node-modules note: worktree checkouts materialize the committed dangling symlink (see B18
lead); `npm install` in a worktree replaces it — never stage `node_modules` changes.

## Blockers

1. **ALL Vercel deployments point at PROD Supabase (pmunbflbjpoawicgimyc) — found
   2026-07-02 ~16:10 via rule 4's sanity check.** Branch previews (!397/!398),
   gg-qa-iota, and prod all resolve the same prod ref in their bundles; zero
   deployed surface uses staging (ppyouymvnrqxcsllrmsl). This is the documented
   §4 gap in docs/supabase-environments.md ("QA writes land in prod ... Not for
   tester data-entry yet") — meaning the team's live QA walkthroughs on
   gg-qa-iota have been writing to the prod DB. Interactive preview verification
   is FORBIDDEN until fixed (would create QA rows on prod). **Yonas/Yair: fill
   the Vercel Preview-scope env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
   / DATABASE_URL / SUPABASE_SERVICE_ROLE_KEY) with the staging project's values
   per supabase-environments.md §4, then redeploy the loop branches.** SSO
   protection itself is now off (previews load without login) — env is the last
   wall.
2. **Staging Supabase keys not available locally:** `.env.local` holds the PROD
   ref; the `.env.staging.local` template from ENVIRONMENTS.md does not exist on
   this machine. Blocks: create-test-users.mjs on staging, and any local
   API-touching run against staging. **Provide `.env.staging.local` (staging
   URL / anon / service-role / DATABASE_URL) or run `npm run env:staging` setup.**
3. **Claude-in-Chrome extension unresponsive** (tabs_context times out; same
   failure as prior session — likely a pending permission prompt in the side
   panel). Workaround in use: Playwright headless for no-write checks.
   **Yonas: check the Chrome extension side panel / restart Chrome.**
