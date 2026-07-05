# Builder-to-engine lane (Slot B) — STATUS

Lane doc: gg-spec/docs/fable-lane-builder-engine-2026-07-03.md (parent: fable-window-plan-2026-07-03.md).
Base: origin/staging @ 5750a2fb (merge train !398 !400 !401 !397 !403 !402 verified merged).

**CURRENT (2026-07-05)**: staging retired — main is trunk (QA-only); production deploys
ONLY from protected `production` branch. Merge freeze lifted. !440 (B32) MERGED @ 145e0767.
Sole open lane item: !411, kept synced to main, conductor merges last.

**MERGE HOLD LIFTED** (observed 2026-07-03 ~22:00 EAT): Yair merged the whole chain
!408 !412 !413 !414 !416 !418 !410 !419 into staging 16:10-16:39 EAT. Remaining: !411 only
(L1-3 derive-maps), reconciled with the landed chain (planned generate-flow.ts conflict
resolved keeping both sides), un-parked and marked READY for review. The orb bug this lane
reported also landed as fix B27 (fix/orb-overlay-tap-clearance-b27).

**PRIORITY CHANGE (Yair, 2026-07-03 ~13:50)**: after L1-LOOP-1, jump to L1-LOOP-3
(L1-5/6/7) then L1-LOOP-4 (L1-8) BEFORE L1-LOOP-2 (L1-3/L1-4). Flows live first,
hardening after. L1-3 was already built when the change arrived; parked as draft !411.

| ID   | Item                                                                                                                                               | Status | MR  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --- |
| L1-1 | Validate at the boundaries (zod Export schema, throw on unknown type, post-transform checks)                                                       | open   |     |
| L1-2 | Typed registries (satisfies Record<FlowComponentType,...>, kill beatEngineMeta JSON re-import)                                                     | open   |     |
| L1-3 | Derive step maps from flow JSON (ENTRY_SERVER_STEP, STEP_TO_SCREEN_ID, SCREEN_TO_STEP, beatForStep, LLM addendum, preconditions)                   | open   |     |
| L1-4 | Canonical artifact (delete/demote designerSource.ts mirror + onboarding-beginner-v1.ts fallback)                                                   | open   |     |
| L1-5 | Multi-flow enablement (flow registry, conditional fork passes, new TYPE_TO_COMPONENT entries, per-flow persistence, generic /flow-preview/:flowId) | open   |     |
| L1-6 | Morning check-in from the builder                                                                                                                  | open   |     |
| L1-7 | Evening check-in from the builder                                                                                                                  | open   |     |
| L1-8 | App tour from the builder (stretch)                                                                                                                | open   |     |

RESOLVED BLOCKER: conductor granted exclusive use of qa-onboarding-fable@guidedgrowth.test
(2026-07-03 ~16:20); all walks done with it. REMAINING permission gate: account RESET
(mirror of qa-reset deletes) was denied by the session permission layer, so a
STANDALONE !408 onboarding re-walk is parked (chain build contains !408; artifacts
byte-identical, so coverage is substantive). QA_RESET_TOKEN is not in .env.local;
operator can reset via the token'd endpoint or grant the delete permission if a
standalone walk is wanted.

STAGING MOVED 15:38 EAT (R2 resume fix 3ee5bb27 landed during the hold, presumably anchor demo-blocking): all 10 lane branches staging-synced via cascade merges, zero conflicts, suites green at chain tip (1516) and !411 (1499). Lane merge-hold discipline unchanged: drafts only.

NEW BUG (proposed B24, NOT this lane's to fix - orb surface is anchor/Lane-2 territory):
the floating voice orb overlay (pointer-events-auto) COVERS the check-in card's Continue
CTA and swallows taps - flow wedges at the state check. Reproduced on STAGING (gg-qa-iota,
pre-existing, not a lane regression) AND at phone viewport 375x812 (button y=717 center
under the orb) - real users cannot finish a check-in by tap wherever the orb overlaps.
Evidence: elementFromPoint at CTA center returns the orb div; JS .click() bypass advances
fine. Found while browser-verifying L1-6 on preview gg-n0667ti91.

Lane fix shipped meanwhile: check-in Exports now author voiceEngine none (generated meta
had defaulted openers to Cartesia - 401 TTS calls on preview + audio-gated reveal;
render parity with the meta-less hand defs restored; cascaded through the chain).

Preview walks DONE without the QA test user (auth-free routes): morning + evening
check-ins and the 5-beat tour all VERIFIED end-to-end on preview (build gg-n0667ti91).
Still needing the test user (operator blocker stands): full ONBOARDING walk + persist=real saves.

ADD-ON (conductor, 2026-07-04): B28+B29 fixed in ONE draft MR !421 (anchor authorized the
voice surfaces). Tap-to-play affordance + 4s text fallback on autoplay holds (B28), reveal
un-pinned while audio plays without duration metadata (B29), gesture bless of the pooled
clips on Get-started/QA-tile taps. B4 hold/settle semantics preserved and pinned by the new
openerRevealPin unit matrix. Verified on the fix preview with autoplay BLOCKED: 5/5
scenarios pass; before-run on staging shows the b1 frozen hold (pill=false, rejected=2).
Conductor merges.

Updated: 2026-07-04 04:4x EAT — !421 (B28+B29) MERGED by the conductor after an independent verification pass on the fix preview; !411 re-synced with staging (absorbed the reflection-setup persistStep fix cleanly, suite green) and remains the ONLY open lane item, awaiting review

---

Updated: 2026-07-05 ~01:00 EAT — TRUNK CUTOVER + MIGRATION absorbed. The gitlab.com group
was archived 2026-07-04 (migration freeze) and the team moved to self-hosted
gitlab.guidedgrowthapp.com (this checkout's origin now points there; MR iids preserved).
staging is retired — main is the trunk; gg-qa-iota builds from main.

Conductor tasks this cycle:

1. Three-flow verification vs CURRENT gg-qa-iota (main build): morning check-in 4/4 beats
   PASS (state-check taps -> Continue via trusted click -> wrap), evening check-in 5/5 PASS
   (habit-review "3 done today." -> reflection "Reflected." -> wrap), home tour 5/5 PASS
   (caption taps land/connect/reveal/chat -> "Let's go" completes). The desktop "not
   advancing" report does NOT reproduce — consistent with a mid-train build artifact.
   (One transient full Vercel outage mid-walk, recovered; not app-related.)
2. !411 un-parked: synced onto main a5013d9c through the cutover. The Weekly landed as
   hand-table edits in the three files !411 retires — resolved keeping the derived
   architecture; weekly-day-setup (step 9, ONBOARD-WEEKLY-SETUP, owner weekly-day-picker)
   now flows from the generator; preconditions gains the weekly gate (byte-identical
   message) keyed by componentType; cutover fixtures extended. tsc clean, 1638/1638 tests
   (160 files). Conductor pinged for merge (note_3462).
3. Standing by for Yair's flow-content batch (The Weekly's new flow already came through
   the LINEAR_EXPORTS pipeline cleanly — validates the multi-flow design under real use).

---

Updated: 2026-07-05 ~09:15 EAT — LANE CLOSED by operator ("everything done"). All build
work merged to trunk. !411 remains open, synced to main 7dc0e20b, green (1641 tests /
161 files), un-parked and pinged — conductor merges. Watch loop disarmed.

---

Updated: 2026-07-05 ~11:00 EAT — BUNDLE ARBITRATION + B32 STATUS. Conductor ruling: the
skimmer lane independently fixed B32-B35 (!434-!437); builder's !440 WINS B32 (!434
superseded); builder STANDS DOWN on B33/B34/B35 (skimmer's !435/!436/!437 ship, live
skimmer !438/!439 stacked on them). Remaining builder scope: !440 evidence -> conductor
merges; keep !411 synced (merges last); Yair's flow-content edits when they arrive.

B32 (!440, fix/b32-plan-review-handoff): fix + 3 jsdom tests DONE (1635/1635, tsc clean).
Root cause: confirm_plan is validate-only; chat-native flow has no consumer; orchestrator
coach-advance bails on persist-less beats -> terminal chain voice-dead. Fix: IntoAppAdapter
subscribes to the confirm_plan voice action, mirrors the tap (one-shot, readOnly-guarded).
Evidence harness (.frugal-fable/b32-evidence.mjs, Playwright fake-mic): before-run on main
build reproduces the dead-end live (22 /api/llm dispatches, zero advance). NOTE: the
builder QA account's staged row was WIPED mid-day (likely the skimmer lane's parallel
verification) — harness now re-stages by tap-walking the full beginner lane first;
final before/after runs in progress, will be posted on !440.

---

Updated: 2026-07-05 ~12:30 EAT — B32 EVIDENCE DONE, !440 READY (marked ready, conductor
pinged, note_3514). Evidence surfaced a SECOND break: the model NEVER calls confirm_plan
on ONBOARD-COMPLETE (0/14 voice turns, right screen/tools/addendum verified in captured
request bodies; it narrates "You're all set!" instead) — so any confirm_plan-consuming
fix alone (!440 v1, likely !434 too) is starved. Composed fix on !440: deterministic
affirmation intercept in sendUserTurn (detectAffirmation, ONBOARD-COMPLETE) emits the
synthetic confirm_plan action; the !440 adapter listener advances like the tap. After-run
on the fix preview: voice "let's go" -> beat advances in 15s, ZERO taps, coach still
replies. Harness + artifacts: .frugal-fable/b32/ (before-final = stuck on main build;
after-composed = PASS). tsc clean, 1635/1635.

---

Updated: 2026-07-05 ~14:15 EAT — !440 HOLD RECONCILED (note_3527). Yair's verification
(note_3512) FAILed the v1 build correctly but misdiagnosed the mechanism: it keyed
"confirm_plan succeeded" off the coach's reply phrasing ("You're all set... Welcome to
Guided Growth!"). Captured SSE bodies from the SAME build show that exact phrase in 11
separate streams, each with tool_rounds:0 — pure model narration, no tool call, so
onCapture never fired and the advance path was never exercised (consistent with the
ledger's own P0-false-alarm resolution + 10+ tap advances in my staged walk). The hold's
"shared beat-advance regression" premise is disproven. The composed fix (74a159b8,
deterministic affirmation intercept + listener) passes Yair's exact method on preview
gg-4e1x24kvz: voice "let's go", zero taps, advance in 15s. Asked for the hold to lift;
suggested keying tool ground-truth on SSE tool_rounds, not phrasing.

---

Updated: 2026-07-05 ~15:30 EAT — CONDUCTOR CORRECTIONS ABSORBED. (1) note_3527 accepted:
phrasing-keyed evidence INVALIDATED, tool_rounds is the standing ground-truth rule;
!440 hold VOID. (2) MERGE FREEZE LIFTED — production now deploys only from the protected
`production` branch; main is QA-only again. (3) !440 re-test is the CONDUCTOR'S (running,
keyed on tool_rounds + DOM advance, incl. the early-utterance race). Pre-confirmed the
race is real on !440 HEAD (note_3530): cardReadyOverride=mp3.done delays the adapter
mount past the opener; bus doesn't replay; early affirmation drops. Follow-up (listener
lifted to BeatView, wip/b32-into-app-2026-07-05) lands AFTER !440 merges, per ruling —
!440 unchanged. Post-opener path (Yonas's actual repro) covered and verified. Queue
unchanged: !411 synced (merges last), Yair's flow edits preempt.

---

Updated: 2026-07-05 ~15:45 EAT — **!440 (B32) MERGED** (main 145e0767). Conductor's
independent re-verification on the composed preview: T1 normal PASS (advance in ~9s,
tool_rounds=1); T2 early-utterance race PASS x2 (speech feeding before the card/opener
existed in the DOM; the theoretical mount race did not reproduce — transcription+LLM
latency outlasts the opener, and the model itself called confirm_plan in these runs).
Ground truth = DOM advance + SSE tool_rounds per the new standing rule. !411 re-synced
onto post-B32 main (1660/1660, 163 files, pushed) — the LAST open lane item, conductor
merges. Remaining watch: !411 merge, review notes, Yair's flow-content edits (preempt).

**2026-07-05 (post-!440-merge tick)**: main moved to 0e0a2d3f (chore/parser-queue-x1-x4 —
retires parseProfileSpeech + its tests, extends detectAffirmation, adds voice-name
normalization tests). !411 re-synced onto it: merge clean, tsc clean, 1658/1658 tests
(count down from 1660 = the retired parser's tests removed on main), pushed 0967373e.
gg-spec new commits are docs/QA-run only — no flow-content Exports yet. Conductor's
corrections message re-received and re-confirmed: all four points already incorporated;
point 3 overtaken by events (re-test PASSED T1 + T2 race ×2, !440 merged). Header above
updated to current trunk/production state. Notes-check degraded this tick: GitLab API
token not available in this shell (credential search stopped per policy) — review notes
on !411 will be caught next tick or via conductor ping.

**2026-07-05 ~20:47**: main moved to 37853412 (latency-t1-spans telemetry —
beat_transition_ms spans stitched by turn id; touches useFlowOrchestrator + adds
latencySpans.ts). !411 re-synced: clean auto-merge incl. orchestrator, tsc clean,
1658/1658, pushed 155121dc. gg-spec new commits are latency-lane T2 baseline docs —
still no flow-content Exports from Yair.

**2026-07-05 ~21:22**: main moved to f3645d2b (chore/gitlab-selfhosted-migration —
api/\_lib/gitlab.ts + .env.local.example; the migration owner's edits, landed as a
proper MR). !411 re-synced: clean merge (2 files, no overlap), tsc clean, 1658/1658,
pushed. gg-spec unchanged — still no flow-content Exports.
