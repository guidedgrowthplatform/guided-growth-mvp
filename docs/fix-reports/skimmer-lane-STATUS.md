# Live-skimmer lane — STATUS

Lane doc: gg-spec/docs/fable-lane-live-skimmer-2026-07-04.md (parent: fable-window-plan-2026-07-03.md).
Closes: B26 (advanced path never consults the LLM, renders raw text fragments as habit names).
Status branch: skimmer-lane-status-2026-07-04 (docs-only, never merged until the end).

## GATE DISSOLVED 2026-07-05 (conductor decision, relayed by the operator)

No B32–B35 MRs ever appeared and Yair confirmed the bundle is not being worked elsewhere. The gate is
replaced by OWNERSHIP TRANSFER: this lane now owns B32–B35 as its first phase (single ownership of the
shared hot files removes the conflict the gate protected against). New order of work:

1. B32 (plan-review "Let's go" dead-end) + B33 (duplicated opener text with voice on) — demo-critical,
   one small draft MR each or a stacked pair.
2. B34 (age+gender merged bubble, voice path) + B35 (vanishing habit-schedule card, voice path).
3. S1–S4 skimmer work as planned, stacked on top.

Branch off current origin/main; all MRs target main as drafts; standing rules unchanged (authored
sources + flow:sync, fix reports, preview evidence). The 30-minute gate-recheck loop is stopped.

PORT SOURCE RESOLVED: feat/capture-real-beat pushed to the new GitLab at e0000659
(src/onboarding-flow/BrainDumpCapture.tsx, parseBrainDumpRegex.ts, parseBrainDumpRegex.test.ts — the
regex tests already exist upstream). Port content against current main, never merge (~400 commits stale).

## Superseded: original launch gate (kept for the record)

Gate: builder-lane bug bundle B32–B35 merged into the integration branch (now `main`) before this lane forks.

AUTHORITATIVE definitions (central ledger reconciliation, 2026-07-04 midday): B32–B35 are the ROUND-2
VIDEO WAVE, dispatched to the builder-lane session — B32 plan-review "Let's go" dead-end (DEMO-CRITICAL),
B33 duplicate opener text every beat with voice on, B34 age+gender merged in one bubble on the voice path,
B35 habit-schedule card vanishes after fill on the voice path. (My bootstrap entry here misattributed the
context lane's four bugs to these IDs — those were RENUMBERED B36–B39 in the same reconciliation; corrected.)

- Conductor board at takeover (2026-07-04 23:25): "builder bundle B32-B35 not yet MR'd … its merge unlocks
  the skimmer lane."
- Re-check 2026-07-05: NO bundle MRs on the new server (open: !432 read-options, !431 vapi cap, !430 B37,
  !426 parsers, !422 weekly, !415 spans, !411 derive-maps). Nothing merged to main names B32–B35.
- !411 (derive step maps) stays parked until rebased onto the landed chain; conductor merges it LAST.

Gate re-check continues on a ~30-minute cadence; read-only prep only until it opens.

## Trunk cutover + GitLab migration (supersedes the earlier "staging deleted" note)

- 2026-07-04: TRUNK CUTOVER — `main` is the integration branch; `staging` retired and now protected
  (push/merge = No one) on the new server.
- 2026-07-04 night: MIGRATION EXECUTED — gitlab.guidedgrowthapp.com is live; gitlab.com is read-only/
  archived. MR iids !428/!429 are RECYCLED on the new server (pre-cutover references mean the old server's).
- This lane's checkouts repointed 2026-07-05: app repo + gg-spec origins → gitlab.guidedgrowthapp.com
  (HTTPS + glab credential helper; host user aligned). Migrated refs verified current — this status branch
  came over at my exact last push (8ac8d5d1); gg-spec origin/main == integrity-verified 265ecc5b, lane doc
  unchanged since my full read.
- My earlier flag "!425/!426 target a deleted branch" was resolved by the conductor's sweep (7 MRs
  retargeted staging→main; !427 closed superseded).

## Adjacent movement relevant to this lane

- B39 (ex-context-B35, dynamic replies never spoken in voice mode) MERGED (!425, merge a5013d9c) and
  fake-mic verified 2026-07-05 01:27 — S3's spoken-path checks will run against a working TTS reply path.
- !428 old-server (identical-turn silent drop) merged — consecutive identical voice turns dispatch again;
  also good for S3 (messy repeated clauses while dumping habits).
- B37 (ex-context-B33, MAX_HABITS=2 drops the advanced 3rd habit) draft !430 open — compounds B26; if it
  merges before SK-LOOP-1 lands, the skimmer's LLM-cleanup path must be tested with >2 habits.

## Work ledger

| ID | Item | Status | MR |
|---|---|---|---|
| B32 | plan-review "Let's go" does not transition into the app (DEMO-CRITICAL finale dead-end) | FIXED, draft MR — root cause: the `into-app` beat's only voice advance is `confirm_plan`, and IntoAppAdapter had no voice-action listener; spoken confirms were silently dropped. Fix: consume confirm_plan → onCapture (ProfileAdapter pattern, submittedRef-guarded). 3 regression tests. tsc + 1635 green. Preview evidence pending | [!434](https://gitlab.guidedgrowthapp.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/434) |
| B33 | duplicate opener text every beat with voice on | FIXED, draft MR — root cause: BeatPlayer karaokes the authored opener AND (voice on → chatEnabled) useOnboardingChat streams/commits the same opener into the store, which BeatConversation rendered unguarded (live partial during TTS, committed copy after). Fix: opt-in `hideOpener` on BeatConversation, passed only from the two direct-LLM BeatView branches; Vapi + past-beat replay untouched. 2 regression tests. tsc + 1634 green. FLAGGED follow-up ledger row: opener AUDIO also plays twice (useBeatOpenerCartesia + tts-service both speak it — the "two sounds" report); separate scoped MR, not folded into this one | [!435](https://gitlab.guidedgrowthapp.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/435) |
| B34 | age+gender merged into one bubble on the voice path (B5 voice-leg) | FIXED, draft MR stacked on !435 — root cause: the active-beat merged copy was B33's duplicate (now hidden); the residual is the PAST-beat replay rendering the committed store opener verbatim (renderTurn, no openerTurns split). Fix: replay a committed opener through openerTurns, one bubble per line; active karaoke + Vapi unchanged. 2 regression tests. tsc + 1636 green. Caveat filed: if the LLM re-flows the opener (drops \n) the stored text is pre-merged — verbatim fidelity is context-lane wording territory | [!436](https://gitlab.guidedgrowthapp.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/436) |
| B35 | habit-schedule card vanishes after fill on the voice path (B21-family) | FIXED, draft MR stacked on !436 — root cause: past-beat receipt card remounts inside BeatConversation with an unconditional animate-fade-in, restarting at opacity 0 right after the beat freezes (voice-only: only voice populates session.messages → hasBeatConversation branch; tap path's direct frozen branch never animates). Fix: fade-in is active-beat-only. 2 regression tests. tsc + 1638 green. Two flagged follow-ups in the MR (ScheduleCard auto-submit design question; HabitScheduleAdapter null-on-empty-configs race) pending live repro | [!437](https://gitlab.guidedgrowthapp.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/437) |
| S1 | Port the skimmer core (BrainDumpCapture.tsx, useBrainDumpCapture, parseBrainDumpRegex.ts + regex unit tests, drop sim fallback) | DONE, draft MR stacked on !437 — parser + 13 tests verbatim; component re-authored: house parseBrainDump client only (sim fallback + explicit anon_id dropped), polarity via new server habitType + lead-verb instant heuristic (curated-polarity modules NOT ported, #224-adjacent), regex tier now runs on interims per the locked architecture (stale source ran it on finals only), typed composer added for S3/S4 parity. tsc + 1652 green | [!438](https://gitlab.guidedgrowthapp.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/438) |
| S2 | Register + schema (ADAPTER_REGISTRY advanced-capture → BrainDumpCapture; per-habit days/polarity in the capture contract; replay renders cards) | open, phase 3 | |
| S3 | Voice-in + reconcile verification (interim STT hookup; ~1s/clause card formation; LLM refine after pauses; typed parity) | open, phase 3 | |
| S4 | Preview proof + B26 closure (phone viewport, spoken + typed dumps, edits/deletes survive reconcile, replay after refresh) | open, phase 3 | |
| S5 | Daily-reporting scoping note (phase 2 stub, no code) | DRAFTED 2026-07-05 during the gate hold: gg-spec branch skimmer-lane-s5-daily-reporting (docs/skimmer-phase2-daily-reporting-2026-07-05.md, 00635aa). Docs-only; conductor/Yair merges. Refine the "what changes" list after S1–S4 land | |

## Blockers

None open. RESOLVED 2026-07-05: (1) port source pushed as feat/capture-real-beat @ e0000659;
(2) launch gate dissolved — this lane owns B32–B35 (see gate-change section above).
Still pending on others, non-blocking: B37 cap decision (draft !430, NEEDS-YAIR) — retest skimmer
LLM-cleanup with >2 habits if it merges during this lane.

## Read-only prep findings (verified on origin/main @ 5df99b72; re-verify hot files at fork time)

- `/api/llm/parse-brain-dump` live: route in api/llm/[...path].ts:135 → api/_lib/llm/parseBrainDump.ts;
  client wrapper src/api/parseHabits.ts. Survey gap item 6 confirmed.
- ADAPTER_REGISTRY (src/onboarding-flow/renderer/componentRegistry.tsx:1744) is `satisfies
  Record<FlowComponentType, ...>` — typed-registry safety net in; swapping `'advanced-capture':
  BrainDumpAdapter` (plain textarea card) to the ported component is the S2 edit point, and FROZEN_BY_TYPE
  will demand an explicit freeze decision for the new card.
- Capture contract today persists only `brainDumpText` (designer-source.json:658 captureFields; generated
  flow; stepMapParity/serverCaptureForBeat/resumeFromServerRow tests). The S2 schema gap is real.
- S3 gating flag: `VITE_STATE3_ENABLED` → `VOICE_IN_ENABLED` (src/lib/config/voice.ts:23);
  useVoiceInCapture consumed in OnboardingVoiceProvider.tsx:1485 behind `voiceInShouldBeLive`. Same env
  name the skimmer sim used.
- `.frugal-fable/` gitignored on main (.gitignore:150) — delegation scratch convention usable as-is.
- Landmines re-confirmed: useLiveSkimmer/liveSkimmer ghost-fill is a separate system; parseHabitsFromText
  stays untouched; flow-designer LiveScan preview out of scope. NOT deep-reading componentRegistry.tsx /
  useFlowOrchestrator.ts during the hold — they are the bundle's hot files; port against the tip at merge time.

## Usage / discipline

- Ultracode OFF confirmed. frugal-fable vendored skill installed from gg-spec (SKILL.md inspected first).
- Weekly-cap telemetry not readable in-session; operator's usage pill is authoritative. At 60%: stop
  opening new work, finish review-ready, snapshot, pause.
- Main checkout (/Users/jonah/Documents/guided-growth-mvp) carries another session's uncommitted work on
  feat/onboarding-voice-track1 — this lane works only in its own worktrees.

Updated: 2026-07-05 (3) — PHASE 1 BUILT: B32 draft !434 (pipeline #988 green; preview
https://gg-emuc7cxkb-guided-growths-projects.vercel.app) and B33 draft !435 (pipeline #989 running).
Both fixes root-caused via delegated read-only surveys (.frugal-fable/b32|b33/notes.md on the lane
worktree), implemented + unit-pinned in this session. B34/B35 surveys running in background. Next:
preview voice-walk evidence for !434/!435 (fake-mic harness pattern from the b39 verification), then
B34/B35 fixes, then S1–S4.

Earlier today (2): gate re-check unchanged; operator asked if the lane was done — answered NO; S5 drafted
on gg-spec branch skimmer-lane-s5-daily-reporting.
