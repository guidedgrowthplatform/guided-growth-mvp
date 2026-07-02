# Onboarding bugfix status — plan of 2026-07-02

Source ledger: `gg-spec/docs/onboarding-bugfix-plan-2026-07-02.md`. One row per bug ID.
Statuses: `open` / `in-progress` / `solved` / `blocked` / `merged-into-other`.
Updated the moment a status changes; this branch (`bugfix-status-2026-07-02`) is the single source of truth.

| ID | Bug | Loop | Status | MR | Notes |
|---|---|---|---|---|---|
| B1 | QA control: "Full onboarding" didn't start from beginning | 6 | partially solved | — | c8f85490 one-tap-fresh verified live 2026-07-02; remainder = QA screen audit (Loop 6) + downstream B17/B9 |
| B2 | Coach voice toggle OFF after refresh; must start ON | 2 | open | — | |
| B3 | Cartesia opener silent while captions render | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | root cause: NO player existed for engine=cartesia beats in the flow renderer; new useBeatOpenerCartesia wraps speakOpener |
| B4 | MP3 clips don't play; dead air + long LLM think after path answer | 1 | fix-implemented (playback facet), preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | autoplay-rejection now defers to next gesture; dead-air facet is NOT playback — cross-filed to Loop 3 (B11 LLM stall) + Loop 2 (B20 wiring) |
| B5 | Age + gender prompts merged into one bubble | 4 | open | — | |
| B6 | Chat bubbles disappear randomly | 4 | open | — | |
| B7 | Profile card disappears after age + gender given | 4 | open | — | |
| B8 | "You're signed in" banner shows during onboarding | 2 | open | — | |
| B9 | Refresh mid-onboarding lands on wrong component + injects extras | 2 | open | — | live repro 2026-07-02 pm: refresh while stuck on habit-selection jumped 5 beats to weekly projection, no components rendered; MUST be a Loop 2 verification-matrix case |
| B10 | Flow jumped welcome → profile, skipping in-between beat | 2 | open | — | |
| B11 | LLM calls fail repeatedly; flow wedged at habit render | 3 | open | — | |
| B12 | LLM invents process talk ("confirm your path choice") | 3 | open | — | likely falls out of Loop 2 map fix |
| B13 | (folded into B4) | — | merged-into-other | — | |
| B14 | First spoken word cut off at clip start | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | first play gated on canplaythrough (2.5s bound); USER-first-word STT variant lives on feat/onboarding-voice-track1 → Loop 5 |
| B15 | Clips not pre-buffered; start rides the network | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | openerPreloadPool warms all clips at flow mount |
| B16 | Mic not armed early / not opened at clip end | 5 | open | — | needs Loops 1+2 |
| B17 | QA "Restart fresh" renders old chat thread (client cache not cleared) | 4 | open | — | root cause verified: QAControlScreen restart path never clears thread store |
| B18 | Recurring staging build error re-merged by diverged branches | — | tracked-elsewhere | — | handled separately; Loop 3 rules it out before B11. **LEAD (found 2026-07-02):** origin/staging has a COMMITTED `node_modules` symlink (mode 120000) → `/Users/yairamsel/Developer/ggmvp-unified/node_modules` — a machine-local absolute path, dangling everywhere else, and exactly the kind of artifact diverged branches keep re-merging. Whoever owns B18 should delete it on staging and add a CI guard (`git ls-files node_modules` must be empty). |
| B19 | Loading bubble renders/sticks on some beats when loading transcript/components | 4 | open | — | live QA walkthrough 2026-07-02 pm |
| B20 | Voice check-in save acked by coach, but card never updates and next beat never loads | 2 | open | — | confirms the record_checkin/submit_morning_checkin wiring gap already in Loop 2 scope |
| B21 | Completed subcategory beat removed from timeline; habit-selection + habit-schedule render simultaneously | 4 | open | — | removal = B6/B7 unmount class; double-render its own sequencing defect |

## Loop status

| Loop | Scope | Status | Branch | MR |
|---|---|---|---|---|
| 0 | Prior-fix archaeology | done | bugfix-status-2026-07-02 (docs/prior-fixes/) | — |
| 1 | B3 B4 B14 B15 | fixes implemented + tested; preview verification pending (blocker below) | bugfix-loop1-audio | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) |
| 2 | B9 B10 B2 B8 B20 | in-progress: investigation done, root cause found, no code yet | bugfix-loop2-resume (pushed, at staging tip) | — |
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

1. **Preview browser verification (affects every loop's close condition):**
   preview deploys sit behind Vercel SSO (raw `*.vercel.app` deploy URLs 302 to
   vercel.com/sso-api), so verification needs the operator's authenticated
   Chrome — and the Claude-in-Chrome extension is currently unresponsive
   (tabs_context times out; likely a pending permission prompt in the side
   panel). **Yonas: check the Chrome extension side panel / restart Chrome.**
2. **Staging Supabase service key not available locally:** `.env.local` holds
   the PROD ref (pmunbflbjpoawicgimyc), so `scripts/qa/create-test-users.mjs`
   cannot create the per-loop `qa-onboarding-fable-<loop>@` users on staging
   (ppyouymvnrqxcsllrmsl). Fallback: use qa-onboarding-yonas (operator's own
   account) once the browser works, or provide the staging service key.
