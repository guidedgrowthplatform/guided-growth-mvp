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
| B5 | Age + gender prompts merged into one bubble | 4 | fix-implemented, preview recheck pending | [!400](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/400) | |
| B6 | Chat bubbles disappear randomly | 4 | fix-implemented, preview recheck pending | [!400](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/400) | |
| B7 | Profile card disappears after age + gender given | 4 | fix-implemented, preview recheck pending | [!400](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/400) | |
| B8 | "You're signed in" banner shows during onboarding | 2 | fix-implemented, preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | passed auth beat renders nothing in the timeline |
| B9 | Refresh mid-onboarding lands on wrong component + injects extras | 2 | fix-implemented (evidence-driven resume), preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | resumeFromServerRow stops at first beat missing its data fingerprint; refresh-matrix test derived from generated flow |
| B10 | Flow jumped welcome → profile, skipping in-between beat | 2 | fix-implemented (same resume rewrite), preview verification pending | [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | numeric step 2 no longer catapults past pre-fork beats (regression test in) |
| B11 | LLM calls fail repeatedly; flow wedged at habit render | 3 | open | — | |
| B12 | LLM invents process talk ("confirm your path choice") | 3 | open | — | likely falls out of Loop 2 map fix |
| B13 | (folded into B4) | — | merged-into-other | — | |
| B14 | First spoken word cut off at clip start | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | first play gated on canplaythrough (2.5s bound); USER-first-word STT variant lives on feat/onboarding-voice-track1 → Loop 5 |
| B15 | Clips not pre-buffered; start rides the network | 1 | fix-implemented, preview verification pending | [!397](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/397) | openerPreloadPool warms all clips at flow mount |
| B16 | Mic not armed early / not opened at clip end | 5 | open | — | needs Loops 1+2 |
| B17 | QA "Restart fresh" renders old chat thread (client cache not cleared) | 4 | fix-implemented, preview recheck pending | [!400](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/400) | root cause verified: QAControlScreen restart path never clears thread store |
| B18 | Recurring staging build error re-merged by diverged branches | — | tracked-elsewhere | — | handled separately; Loop 3 rules it out before B11. **LEAD (found 2026-07-02):** origin/staging has a COMMITTED `node_modules` symlink (mode 120000) → `/Users/yairamsel/Developer/ggmvp-unified/node_modules` — a machine-local absolute path, dangling everywhere else, and exactly the kind of artifact diverged branches keep re-merging. Whoever owns B18 should delete it on staging and add a CI guard (`git ls-files node_modules` must be empty). |
| B19 | Loading bubble renders/sticks on some beats when loading transcript/components | 4 | fix-implemented, preview recheck pending | [!400](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/400) | live QA walkthrough 2026-07-02 pm |
| B20 | Voice check-in save acked by coach, but card never updates and next beat never loads | 2 | fix-implemented (fill: !396; completion: !398), preview verification pending | [!396](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/396) + [!398](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/398) | card fill lands in !396; beat completion + GREATEST bump + dead-air bump fix in !398 (stacked) |
| B21 | Completed subcategory beat removed from timeline; habit-selection + habit-schedule render simultaneously | 4 | fix-implemented, preview recheck pending | [!400](https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/400) | removal = B6/B7 unmount class; double-render its own sequencing defect |

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
- 2026-07-02 16:50 — HANDOFF to Yair's session: all branches pushed (loop1 fa04074f, loop2 1120062f, status current), STATUS rewritten with per-loop next steps + handoff notes; b11 request body still not received
- 2026-07-02 16:25 — no-write verification lane built: Playwright headless vs the deployed preview's auth-free /onboarding-flow-preview (in-memory persistence, zero DB writes); walker cleared IntroGate but auth beat walls it — added ?startAt=<nodeId> QA param to the preview route (fa04074f on loop1, cherry-picked to loop2), CI redeploying
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

## HANDOFF 2026-07-02 ~16:50 EAT — run continues in Yair's session

**Per-loop state + EXACT next step:**

**Loop 0 — DONE.** docs/prior-fixes/ on this branch.

**Loop 1 (B3 B4 B14 B15) — fixes + tests in, verification partially blocked.**
Branch `bugfix-loop1-audio` @ fa04074f, draft MR !397. TEMP diagnostics commit
**dae9bf1c** (unconditional playback logging in useBeatOpenerMp3) — revert before
undraft. fa04074f adds `?startAt=<nodeId>` to /onboarding-flow-preview for
headless no-write QA. Fresh preview: https://gg-9uy17rwjz-guided-growths-projects.vercel.app
NEXT STEP: run docs/fix-reports/preview-walker.mjs (this branch) against
`<preview>/onboarding-flow-preview?startAt=profile` twice (autoplay-allowed +
default-blocked): assert every MP3 beat fetches its /voice/onboarding/<ID>.mp3
(200) and plays (temp diagnostics lines), Cartesia opener speaks on profile
(B3), no NotAllowedError settles-as-done (B4), preload pool warms clips at flow
mount (B15). THEN (after the Vercel env fix, see Blockers): signed-in fresh +
mid-refresh runs + Slow-3G latency on qa-onboarding-fable-loop1, revert
dae9bf1c, undraft !397.

**Loop 2 (B9 B10 B2 B8 B20) — ALL fixes implemented + unit-verified; preview
matrix pending.** Branch `bugfix-loop2-resume` @ 1120062f, draft MR !398,
**STACKED on !396** (merge after it). tsc clean, 1365/1365 tests, build OK.
Landed: evidence-driven resume (resumeFromServerRow + refresh-matrix test),
four V3 map remaps + flow-derived parity test (stepMapParity.test.ts), B20
completion (BEAT_COMPLETING += record_checkin/submit_morning_checkin, handlers
GREATEST-bump 6/7/8, strictly-increasing client bump + tool→beat guard), B2
voice forced ON at flow mount, B8 auth receipt suppressed, !396 allowedTools
union guard. Preview: https://gg-gd5e2zsf6-guided-growths-projects.vercel.app
NEXT STEP (blocked on the Vercel staging env fix): refresh at persist steps
6/7/8 → SAME beat, no extra components, voice toggle ON; full beginner run no
skipped beats; advanced + fork resume; live B20 (voice save on state-check /
morning advances the beat). Review docs/fix-reports/mr396-review.md first.

**Loop 3 (B11 B12) — NOT STARTED.** The captured failing habit-selection
request body was NEVER received (Yonas said he'd paste it — ask again; save as
docs/fix-reports/b11-request-body.json on this branch). First step: rule out
B18 (staging build state), then the CI-log server-side evidence plan in the
fenced block.

**Loop 4 (B5 B6 B7 B17 B19 B21) — NOT STARTED.** B17 root cause verified
(QAControlScreen restart never clears the client thread store). The auth-free
/onboarding-flow-preview + ?startAt is now available for no-write timeline
repros (B6/B7/B21 unmount class).

**Loop 5 (B16) — pending Loops 1+2.** Prior-fix notes in docs/prior-fixes/;
mic-arm + first-word variants already exist on feat/onboarding-voice-track1
(8de9b66, beed650), unmerged.

**Loop 6 (B1 remainder) — pending.** Reuse Loop 2's B2 fix for launch-with-voice-ON.

**Temp/WIP commit SHAs:** dae9bf1c (Loop 1 temp diagnostics — must be reverted
before !397 undrafts). No other WIP: every branch is fully committed + pushed.

## HANDOFF NOTES — machine-local, does NOT transfer

- **Worktree layout on the old machine** (recreate as needed):
  guided-growth-mvp (main checkout, operator's feat/onboarding-voice-track1 WIP
  — untouched by the loop), ../gg-bugfix-loops (this status branch),
  ../gg-loop1 (bugfix-loop1-audio), ../gg-loop2 (bugfix-loop2-resume),
  ../gg-flow-reference (flow-annotated-render oracle; dev server was :5199,
  `/flow-standalone/`). gg-spec cloned as sibling ../gg-spec.
- **node_modules:** installed with `npm install --ignore-scripts` (supabase-cli
  postinstall fails) + `npx tsc -b packages/shared` afterwards. On branches that
  still track the dangling node_modules symlink (loop1, status), the working
  tree shows a `D node_modules` — NEVER stage it (!396 untracks it properly).
- **.env:** only `.env.local` exists (PROD-pointed). NO `.env.staging.local`
  template exists on the old machine — staging keys were never local. Check
  whether Yair's machine has them (unblocks local staging verification +
  create-test-users.mjs).
- **Playwright:** v1.59 from the repo devDeps; `npx playwright install
  chromium` needed once (headless-shell v1217). The no-write walker is
  committed here as docs/fix-reports/preview-walker.mjs (edit the ROOT import
  path — it hardcoded the old worktree's node_modules; change to a plain
  `import { chromium } from 'playwright'` run from the repo root).
- **Claude-in-Chrome extension** was unresponsive on the old machine (2
  sessions); irrelevant if Yair's works, and Playwright covers headless needs.
- **Preview URLs churn per push** — always re-read the deploy_qa_preview job
  log (`Deployed: https://...`) after any push.

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
- 2026-07-02 16:09 IDT — TAKEOVER: run continues in Yair's session; worktrees rebuilt under ~/Developer/claude-work; walker import made portable; starting Loop 1 no-write verification
- 2026-07-02 19:28 IDT — Loop 1 no-write verification: pool fix (preview route now mounts preloadOpenerClips, commit on loop1) verified locally: all 18 clips + splash + mic warm at mount; full chain walked to ONBOARD-COMPLETE; no NotAllowedError silent settles; AbortErrors are walk-speed artifacts. Env flip: 4/5 Preview rows updated; VITE_SUPABASE_URL Preview missed (still Jun 29) — fresh previews still bundle prod ref; asked Yair for the one-row fix. Starting Loop 4.
- 2026-07-02 19:44 IDT — ENV FLIP VERIFIED: all 5 Preview-scope vars on staging; rebuilt loop previews bundle staging ref x3 / prod ref x0 (loop1 gg-5h6ohbzcn, loop2 gg-gxx5woha8). QA user qa-onboarding-fable@guidedgrowth.test created on staging. Interactive preview QA is now SAFE. Signed-in verification batch starting.
- 2026-07-02 ~20:0x IDT — verification batch session up: staging sign-in REST OK (fable), /api/qa/self-reset on loop1 preview 200, RLS read of onboarding_states OK; NOTE /api/qa/users returns 500 on BOTH previews (dropdown falls back to static list; filed as observation, not a loop bug). Walker harness at /tmp/gg-verify (playwright from gg-loop1 node_modules; worktrees untouched). Starting Loop 1 signed-in runs.
- 2026-07-02 20:10 IDT — Loop 4 COMPLETE: B5/B6/B7/B19/B21 fixed+tested on !400 (B21 root cause included fastForwardToNode burning the flow to completion; B7 was the voice-beat card-loss class). Full suite 1353 green. Preview rechecks folded into the running verification batch.
- 2026-07-02 20:20 IDT — LOOP 1 SIGNED-IN VERIFY, MAJOR FINDING (revises the 19:28 "AbortErrors are walk-speed artifacts" read): on gg-5h6ohbzcn, EVERY useBeatOpenerMp3 beat activates TWICE (~same ms), cleanup of activation #1 pause()s the shared pooled element, its late AbortError then settle()s activation #2 → every MP3 opener is marked done WITHOUT EVER PLAYING (playLog instrumentation: 0 'playing' events for any onboarding mp3; say-only beats like why-intro self-advance hands-off in <100ms). Reproduced hands-off on BOTH /onboarding/flow (signed in) and /onboarding-flow-preview, autoplay allowed AND blocked. B4's settle-as-done symptom is therefore still live via AbortError (the NotAllowedError defer itself is correct: the profile Cartesia opener under blocked autoplay defers → next tap → plays to completion, verified). B15 preload PASS (all 18 clips 206 within ~150ms of mount, both routes, both policies). B3 Cartesia opener PASS (POST /api/cartesia-tts 200, blob plays + ends). Evidence: /tmp/gg-verify/L1-R1-fresh-{result,wire}.json + probe-whyintro-*.json.
- 2026-07-02 20:35 IDT — Loop 1 signed-in batch continued: (a) mid-flow refresh at state-check → resume lands on PROFILE (server step=1, numeric resume; B9 live on loop1 as expected, loop2 owns it); the landed beat's Cartesia opener plays post-refresh (2nd /api/cartesia-tts 200 + playing), MP3 beats still 0 plays. (b) Settle cascade corollary: say-only beats self-advance, so after reflection (step 8 GREATEST pin) the flow catapults past fork+lane and auto-runs plan-review + ALL FIVE weekly-projection beats + completion as silent instant text bubbles (screenshot L1-S-lane-stuck-12.png). (c) ?startAt=<lane node> can't cover BEGINNER-01..04: fastForwardToNode's empty captures wall at the unresolvable path-fork branch, then the cascade burns the shared tail — lane MP3s unreachable signed-in on loop1; their fetch evidence stands via the 18/18 preload. (d) Zero [opener] 401/500 in any run; /api/cartesia-tts 200 x4 across runs. VERDICT FORMING: !397 NOT ready to undraft — playback facet regressed/unfixed on the real route (mechanism above); B3+B15 facets verified good.
- 2026-07-02 20:47 IDT — B11 evidence received (failing habit-selection request body, captured 10:52-11:01 UTC session e6988bc9); saved as docs/fix-reports/b11-request-body.json. Payload is well-formed; strengthens server-side failure theory. Loop 3 starting. Also: auth (Google/Apple) merged to staging as own work; OAuth providers still unconfigured on the staging Supabase project (dashboard config, flagged).
