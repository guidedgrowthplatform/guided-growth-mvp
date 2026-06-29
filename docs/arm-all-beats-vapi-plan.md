<!-- Generated 2026-06-27 by a 9-agent research workflow (run wf_65edbb81-9b3).
Branch of record: vapi-integration (merged engine-resync-v2 + fix/vapi-flow-onboarding + the two blocker fixes).
Goal: arm every onboarding beat for Vapi full-duplex, replicating the ONBOARD-01/FORK pattern. -->

---

# Plan: Arm EVERY Onboarding Beat for Vapi Full-Duplex (Path 1)

This plan widens Vapi full-duplex from today's 2 armed beats (`ONBOARD-01--FORM`, `ONBOARD-FORK--FORM`) to the entire post-mic-grant onboarding spine, replicating the proven profile→fork pattern. The session-model decision is settled — **one long-lived WebRTC session for the whole flow, context pushed per beat via `client.send` add-message** — but its production validity is _contingent_ on two Vapi-dashboard facts that are therefore promoted to pre-merge BLOCKERS. The single biggest correction over the draft: the server `current_step` climb across the post-habits tail is **5→6→7→8→9→10 across six beats**, not the draft's 5→6→7→8, because `beatStep` re-baselines per beat and two beats share `persist.step=5` while plan-review is engine-local step 6 with no backend beat. The exact target_step / `checkAdvanceData` case numbers must be locked by an **instrumented Direct-LLM run (STEP 0)** before any backend guard or RULE-2 map is authored — because that guard is shared with the live Direct-LLM path all current users hit.

---

## 1. Executive Summary + Resolved Session Model

**Primary lever:** `CHAT_VAPI_BEAT_SCREENS` in `src/lib/onboarding/onboardingStepBeats.ts:20`. Widening this Set auto-enables per-beat context push, openers, and form-fill (none of those are armed-gated). All real work is in the _tail-end gaps_ each beat exposes once it goes live, plus one genuine backend build (`submit_morning_checkin`).

### Session model — ONE long-lived session (decision settled; production-validity is CONDITIONAL)

**Decision: one continuous Vapi session spanning all armed beats; NOT per-beat sessions.** Verified evidence:

- Liveness is `vapiShouldBeLive` (`OnboardingVoiceProvider.tsx:1288`) ← `engine==='vapi'` ← `vapiCapableBeat = CHAT_VAPI_BEAT_SCREENS.has(registeredScreenId)` (`:1034`). The start/stop effect (`:1303-1340`) calls `stop()` only when `vapiShouldBeLive` flips **false**.
- Profile and fork are both in the Set today, so the session demonstrably survives that one boundary via the screen-change push (`:1416-1437` → `pushScreenContext` → `client.send({type:'add-message', triggerResponseEnabled:true})`, `:296-339`). Teardown happens at fork→category **only** because `ONBOARD-BEGINNER-01` is absent from the Set.
- **Arming all beats removes a teardown; it is not a new design.** Per-beat would _add_ teardown and pay ~10–12s cold start 7–11× and burn 7–11 cap units.
- **Backend is fully agnostic** (verified): every tool keys on `args.anon_id`, and `vapi_tool_calls` dedup (migration 053) is per-tool-call, not per-session. One session vs per-beat yields byte-identical writes.

**Honest scope of the evidence:** the session is _proven_ to survive exactly **one** of the ~10 boundaries arming creates (profile→fork). Survival across the other boundaries, the advanced-fork lane, idle re-arm, and back-nav into the unarmed AUTH/MIC beats is sound _extrapolation from the same mechanism_, not direct evidence — STEP-0 and the full-walk test (§7) exist to convert it to evidence.

**The one-session model is production-real only IF the dashboard cooperates** — promoted to BLOCKERS (§9):

- **`maxDurationSeconds`** on the shared assistant must be unset/large. A chat-oriented ~3-min cap would silently shatter the "one long session" into many cold-started sessions and **invert the entire cost/cap argument**.
- **Idle auto-pause** (8s silence → `systemPauseMic`, `:1378-1414`) must be beat-aware (A6), or read/tap beats tear the session down every 8s and re-cold-start.

The remaining mid-flow teardown triggers become: idle pause, leaving `/onboarding`, voice-cap, fatal Vapi error, user toggle-off — none are beat boundaries. Idle-pause churn and fatal-error blast-radius are the dominant new risks (§5, §8).

---

## 2. STEP 0 — Lock the canonical step table (BLOCKS B1, B6, C2, B5)

The leading-edge engine (`useFlowOrchestrator.ts:243-269`, verified) re-records `baselineStepRef = serverStep` on **every beat entry** and advances only when `serverStep > baseline AND serverStep > thisStep`, where `thisStep = beatStep(node)` = `persist.step`, or `ENGINE_PERSISTLESS_STEP[screenId]` (only `ONBOARD-BEGINNER-06`→`6`), or `undefined` for `ONBOARD-COMPLETE` (terminal, no auto-advance). Verified `beatStep`/persist values:

| beat            | screenId                | persist.step  | `thisStep`       | to LEAVE, server step must reach  |
| --------------- | ----------------------- | ------------- | ---------------- | --------------------------------- |
| profile         | `ONBOARD-01--FORM`      | 1             | 1                | ≥ 2                               |
| fork            | `ONBOARD-FORK--FORM`    | 2 (pathField) | 2                | ≥ 3                               |
| category        | `ONBOARD-BEGINNER-01`   | 3             | 3                | ≥ 4                               |
| braindump (adv) | `ONBOARD-ADVANCED`      | 3             | 3                | ≥ 4                               |
| goals           | `ONBOARD-BEGINNER-02`   | 4             | 4                | ≥ 5                               |
| habit-select    | `ONBOARD-BEGINNER-03`   | 5             | 5                | ≥ 6                               |
| habit-schedule  | `ONBOARD-BEGINNER-04`   | 5             | 5                | **> entry-baseline (≥7)**         |
| plan-review     | `ONBOARD-BEGINNER-06`   | null          | 6 (engine-local) | **> entry-baseline (≥8)**         |
| morning         | `ONBOARD-MORNING-SETUP` | 7             | 7                | ≥ 8 (and > entry-baseline)        |
| reflection      | `ONBOARD-BEGINNER-07`   | 8             | 8                | ≥ 9 (and > entry-baseline)        |
| complete        | `ONBOARD-COMPLETE`      | null          | undefined        | terminal — fires on null `nextId` |

**Consequence (the central correction):** because habit-select and habit-schedule both carry `thisStep=5`, and plan-review is engine-local `6` with no backend persist, the coach-driven server `current_step` must climb **strictly upward once per tail beat** — the real walk is `…5 → 6 → 7 → 8 → 9 → 10`, well beyond the max persisted step (8). `checkAdvanceData` cases ≥7 hit `default → null` (ungated), so the later climbs are data-ungated _unless we add cases_.

**STEP-0 deliverable (do this FIRST, zero Vapi required):** instrument a full **Direct-LLM `advance_step`** run (it exercises the identical `checkAdvanceData` + identical leading-edge engine through `ONBOARD-COMPLETE`) and record, per beat: entry `current_step`, the `navigate_next`/`advance_step` `target_step` the coach emitted, the `sourceStep` passed to `checkAdvanceData`, and the data precondition present. The resulting table is the single source of truth that B1 (guard cases), B6 (step-5 collision), C2 (RULE-2 target*step map), and B5 (confirm target) all derive from. Do **not** hand-assert the numbers — the draft's "case 7 = morningCheckin" is almost certainly off-by-one (a case-7 morning gate would reject plan-review→morning, since `morningCheckin` is captured on the \_next* beat). Flag any number not produced by this run as unverified.

**Also verified and load-bearing:** on Vapi advances the frontend never double-writes the step — `applyAndAdvance(cap, false)` skips `saveStep` (`:171-178`), so `navigate_next` is the sole server writer. Add a regression assertion (§7) so a future refactor can't reintroduce a `saveStep`-vs-`navigate_next` race.

---

## 3. The Replicable Pattern (distilled from the 2 armed beats)

A beat is "armed" **iff** `screenId ∈ CHAT_VAPI_BEAT_SCREENS`. The machinery is already beat-generic:

| Stage                         | Mechanism                                                                                                                                                                                                          | File:ref                                                     | Armed-gated?                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------- |
| Engine select                 | `vapiCapableBeat → engineForTurn → 'vapi'`                                                                                                                                                                         | `engineForTurn.ts:42-56`; `OnboardingVoiceProvider.tsx:1034` | yes (the Set)                |
| Session start                 | `vapiShouldBeLive` → `useRealtimeVoice.start()` → `buildOverridesForCall`                                                                                                                                          | `OnboardingVoiceProvider.tsx:1288,1303,795`                  | yes                          |
| Cold-start context            | `assistantOverrides.variableValues.initial_screen_context` + `firstMessageMode`                                                                                                                                    | `buildAssistantOverrides.ts:37-72`                           | n/a                          |
| Instant opener (profile only) | `isFirstColdStartBeat` → Cartesia `speakOpener`, Vapi joins silent, dual-gate unmute, 10s failsafe                                                                                                                 | `OnboardingVoiceProvider.tsx:482-536,795-899`                | one-shot via `openerUsedRef` |
| Per-beat warm context         | `registeredScreenId` change while active → `pushScreenContext` add-message (`triggerResponseEnabled:true`)                                                                                                         | `:1416-1437,296-339`                                         | **NO**                       |
| Form fill                     | `voice.setFormSnapshot(answers)` → debounced silent add-message                                                                                                                                                    | `:353-413`; orchestrator `:217-220`                          | **NO**                       |
| Tool → card → advance         | Vapi tool → `api/vapi/[...path].ts` → `dispatch.ts` → handler → Supabase `data`+`current_step` → Realtime → leading-edge watcher → `serverCaptureForBeat` → `applyAndAdvance(save:false)` → `registerScreen(next)` | orchestrator `:243-269`                                      | n/a                          |

**Card auto-fill (verified):** Vapi emits no browser `LLMToolEvent`, so the Direct-LLM live in-card fill (`toolEventToVoiceActions`) does NOT fire on Vapi turns. Vapi card state materializes on the engine advance via Realtime-mirrored `serverState` — exactly as profile/fork work today. No new live-fill wiring needed. `serverCaptureForBeat` already covers every `componentType` (just-landed fix).

---

## 4. Workstreams

### Canonical beats to arm (from `onboarding-beginner-v1.ts`, verified node screenIds — NOT legacy `beatForStep`)

`ONBOARD-AUTH--FORM`(persist null) → `MIC-PERMISSION`(null) → `ONBOARD-01--FORM`(1) → `ONBOARD-FORK--FORM`(2) → **beginner:** `ONBOARD-BEGINNER-01`(3) → `-02`(4) → `-03`(5) → `-04`(5) → `ONBOARD-BEGINNER-06`(null/6) → `ONBOARD-MORNING-SETUP`(7) → `ONBOARD-BEGINNER-07`(8) → `ONBOARD-COMPLETE`(null). **Advanced:** `ONBOARD-ADVANCED`(3) → merges to `ONBOARD-BEGINNER-06`. The legacy `beatForStep` map emits `ONBOARD-ADVANCED-02/-04/-05` that the live flow does not use — ignore it for the Set.

---

### Workstream A — Frontend arming (`src/`)

| #   | Task                                                   | File:symbol                                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Acceptance                                                                                                                                                                          |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Widen the Set                                          | `onboardingStepBeats.ts:20` `CHAT_VAPI_BEAT_SCREENS`                                | Add `ONBOARD-BEGINNER-01,-02,-03,-04`, `ONBOARD-ADVANCED`, `ONBOARD-BEGINNER-06`, `ONBOARD-MORNING-SETUP`, `ONBOARD-BEGINNER-07`. **Hold `ONBOARD-COMPLETE`** (see A8). Keep `ONBOARD-AUTH--FORM` + `MIC-PERMISSION` OUT. Update the "Widen this set" comment.                                                                                                                                                                                                                 | `tsc` clean; `engineForTurn` returns `vapi` on every post-fork beat (unit test).                                                                                                    |
| A2  | Direct-LLM **fallback** advance set                    | `onboardingStepBeats.ts:113` `BEAT_COMPLETING_TOOLS`, `:127` `ADVANCING_TOOL_NAMES` | Add `'submit_morning_checkin'` to both. **Scope note:** these Sets are consumed only on the Direct-LLM chat path (`useChatToolEvents.ts:137`, `useOnboardingChat.ts:409`); Vapi emits no browser tool events, so under Vapi the morning beat advances via `navigate_next`→leading-edge and these Sets are inert. A2 exists solely for the half-duplex fallback (A3).                                                                                                           | On the **Direct-LLM** morning beat, tool success advances + suppresses the trailing line. (Do NOT write a Vapi acceptance for A2.)                                                  |
| A3  | **UX-09 fallback with latch (BLOCKER, ship WITH A1)**  | `engineForTurn.ts:42-56`; consumer `OnboardingVoiceProvider.tsx:1035,1068`          | Thread a `vapiUnavailable` input (`fatalErrorRef \|\| voiceCapReached \|\| remoteEndCooldown`) so a vapiCapableBeat degrades to `direct_llm` (Soniox if mic on) instead of stranding. **Add a per-beat "once degraded, stay degraded" latch/hysteresis** — `engineForTurn` is by design a pure intent selector (`:5-7`), so a cooldown clearing mid-beat must NOT flip `direct_llm→vapi` and re-cold-start (flapping). Scope the degrade to the remainder of the current beat. | Force a fatal Vapi error mid-flow → beat finishes on Soniox→/api/llm, remainder of flow completes; a transient cooldown clearing mid-beat does NOT re-arm Vapi until the next beat. |
| A4  | Context bundle gaps                                    | `src/generated/screen_contexts.json`                                                | Add `ONBOARD-MORNING-SETUP` and `ONBOARD-COMPLETE` entries (byte-identical to Master Sheet "Screens" tab).                                                                                                                                                                                                                                                                                                                                                                     | `getScreenContext` resolves from bundle (no `/api/context` dev warning).                                                                                                            |
| A5  | Screen wake-lock                                       | `OnboardingVoiceProvider.tsx` (mirror `VoiceContext.tsx`)                           | Acquire `acquireWakeLock` on session active, release on idle (`src/lib/services/keepAwake`).                                                                                                                                                                                                                                                                                                                                                                                   | Screen stays awake across the multi-minute single session.                                                                                                                          |
| A6  | **Idle-timeout, beat-aware (BLOCKER for one-session)** | `OnboardingVoiceProvider.tsx:1378-1414` `IDLE_TIMEOUT_MS`/`systemPauseMic`          | Lengthen/disable idle pause on non-conversational read/tap beats (`ONBOARD-BEGINNER-06` plan-cards, `ONBOARD-MORNING-SETUP`).                                                                                                                                                                                                                                                                                                                                                  | On a silent read beat the session is not torn down at 8s.                                                                                                                           |
| A7  | Forward-pointer audit                                  | bundle context blocks for every newly-armed beat                                    | Gotcha #10: Vapi gets RAW context (no `stripForwardPointers`). Audit each new beat's block for `NEXT:` / `-> SCREEN` / `--- SUPPLEMENTARY ---` so the coach doesn't pre-narrate the next screen.                                                                                                                                                                                                                                                                               | No coach pre-narration of next beat in the Vapi walk.                                                                                                                               |
| A8  | **Decide `ONBOARD-COMPLETE`: recommend UNARMED**       | `onboardingStepBeats.ts:20`                                                         | `ONBOARD-COMPLETE` is terminal (`nextId:null`), `expectsInput:false`, `persist:null`, `beatStep→undefined` (no auto-advance). Arming it adds cold-start/teardown race surface (coach mid-utterance when `endCall` routes to `/home`) for **zero conversational benefit**. Recommend the single session tears down at the reflection→complete boundary; complete stays Direct-LLM/silent. PO sign-off required.                                                                 | If unarmed: documented teardown point; no coach audio bleeding into `/home`.                                                                                                        |

**Openers:** `onboardingOpeners.ts` already covers `BEGINNER-01/02/03/06/07`. `BEGINNER-04`, `MORNING-SETUP`, `ADVANCED` lack keys — **non-blocking**: only profile is a first cold-start beat; warm beats get a model-spoken opener via `pushScreenContext`. Add keys only if you want a Cartesia opener after an idle re-arm on those beats.

---

### Workstream B — Backend handler parity (`api/`)

**B0 — Shared-guard reality (verified):** `navigateNext.ts:34` imports `checkAdvanceData` from `../../llm/onboarding/preconditions.js`; the `preconditions.ts:1-2` header comment claiming Vapi "is left untouched" is **STALE — disregard**. The guard is shared by both Vapi `navigate_next` and Direct-LLM `advance_step`. So **any** edit to `checkAdvanceData` changes the gating for **all current onboarding users today**, before any Vapi beat is armed.

| #   | Task                                                          | File:symbol                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Acceptance                                                                                                                                                            |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Re-map advance gate **to the STEP-0 table** (gated on STEP 0) | `preconditions.ts:14-46` `checkAdvanceData`                                  | Re-map cases to the proven server climb (NOT the draft's 5→6→7→8). Case 5 (habits) keep. Add data gates at the cases STEP-0 proves correspond to _leaving morning_ (`data.morningCheckin`) and _leaving reflection_ (`data.reflectionConfig`) — almost certainly cases ≈8 and ≈9, NOT 7/8. Make the plan-review source case a pass-through. Update the stale header comment. **Author + atomically co-review with C2.**                                     | `navigate_next` and `advance_step` walk the full tail on BOTH lanes; full regression of the _current_ Direct-LLM onboarding (real users) shows no advance regression. |
| B2  | Add `submit_morning_checkin` Vapi tool def                    | `api/_lib/llm/tools.onboarding.ts` `ONBOARDING_TOOLS` + `OnboardingToolName` | Mirror Direct-LLM `schemas.ts:227-258`; `screen:'ONBOARD-MORNING-SETUP'`.                                                                                                                                                                                                                                                                                                                                                                                   | Tool present; `tsc` clean.                                                                                                                                            |
| B3  | New Vapi handler                                              | NEW `api/_lib/vapi/handlers/submitMorningCheckin.ts`                         | Port from Direct-LLM `handlers/submitMorningCheckin.ts` BUT: accept `db: Queryable` (run inside batch txn — no direct `pool.query`), validate `anon_id` from server param, DATA-ONLY write `data.morningCheckin`, **never touch `current_step`**. Mirror `submitReflectionConfig.ts` — but do NOT copy its stale INSERT-branch step default.                                                                                                                | Writes `data.morningCheckin` inside the savepoint; idempotent via `vapi_tool_calls`.                                                                                  |
| B4  | Dispatch case                                                 | `api/_lib/vapi/dispatch.ts:35-58`                                            | Add `case 'submit_morning_checkin': return submitMorningCheckin(args, db)`.                                                                                                                                                                                                                                                                                                                                                                                 | Webhook routes the tool.                                                                                                                                              |
| B5  | Reconcile `confirm_plan` (gated on STEP 0)                    | `api/_lib/vapi/handlers/confirmPlan.ts:55,61,72`                             | It writes `GREATEST(current,8)` but its coach-facing error text says "Do NOT retry confirm_plan until current_step is 7" — **STALE**: at the into-app beat the server step is ≈9–10 per STEP 0, so this directive can induce a `navigate_next` loop. Fix the text to the proven number; verify `checkPlanReady` (habits+reflection) still correct; confirm completion fires via terminal null-`nextId`, not a step bump.                                    | confirm_plan accepted at COMPLETE; no retry loop; correct directive text.                                                                                             |
| B6  | Step-5 collision (`-03`/`-04`), gated on STEP 0               | `navigateNext.ts:106-130` skip-guard; orchestrator `:243-269`                | Both habit beats `persist.step=5`. Per STEP 0 the coach must drive `current_step` to ≥6 to leave `-03` and to **> the `-04` entry-baseline (≥7)** to leave `-04`, threading the +2 skip-guard. This collision **cascades through the whole tail** (re-baselining + persistless 6) — it cannot be resolved for `-04` in isolation; model `-04, -06, MORNING, -07` together. May require folding the schedule beat under habits or an intermediate step bump. | `-03`→`-04`→`-06` advances under Vapi without stranding or tripping the skip-guard.                                                                                   |

Verified: 12 Vapi handlers exist; only `submitMorningCheckin` is missing. Dedup + batch-txn webhook are generic — no plumbing change.

---

### Workstream C — Vapi assistant config (`scripts/vapi-sync/`)

ALL tools attach to ONE assistant (`VITE_VAPI_ASSISTANT_ID`); no structural per-beat tool gating — selection is steered only by the RULE-2 prompt table + per-call screen context.

| #   | Task                                                                | File:symbol                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                          | Acceptance                                                                                                                      |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Register new tool                                                   | `scripts/vapi-sync/sync.ts` (reads `ONBOARDING_TOOLS`)          | After B2, run sync to POST `submit_morning_checkin`, union into `assistant.model.toolIds`, write `vapi.lock.json`.                                                                                                                                                                                                                                                                                                              | Lockfile gains the tool id; assistant carries 13 tools.                                                                         |
| C2  | Reconcile RULE-2 / step map (**atomic with B1**, gated on STEP 0)   | `scripts/vapi-sync/assistant.ts:46-58` `SYSTEM_PROMPT_ADDENDUM` | Add rows `ONBOARD-MORNING-SETUP→submit_morning_checkin`, `ONBOARD-BEGINNER-04→update_habit`; rewrite the `navigate_next` `target_step` map to the STEP-0 climb (…5→6→7→8→9→10). **Must use the identical numbering as B1** — splitting the two invites the off-by-one that strands the tail; treat B1+C2 as one task.                                                                                                           | Coach calls the right tool + target_step on every newly-armed beat; full Vapi walk reaches COMPLETE.                            |
| C3  | **Crisis/988 + PII shift (BLOCKER for `ONBOARD-ADVANCED` + `-07`)** | Vapi dashboard prompt (out-of-repo)                             | Confirm the dashboard prompt carries the 988/crisis `SAFETY_OVERRIDE` (the verified 988 text in `packages/shared/src/coaching/systemPrompt.ts` is Direct-LLM ONLY). **Compounding factor:** arming `ONBOARD-ADVANCED` moves the _unscrubbed verbatim brain-dump_ (gotcha #8) onto the _unsanitized Vapi context path_ (gotcha #10) — the highest-distress, highest-PII moment now runs on Vapi. Record a verification artifact. | Crisis utterance on brain-dump + reflection beats triggers the 988 boundary over Vapi. Hard gate before arming those two beats. |
| C5  | Sync safety                                                         | `sync.ts:49,229` tunnel guard; per-env lockfiles                | Sync `--staging` first, then prod; confirm `VAPI_WEBHOOK_BASE_URL` is prod (tunnel guard hard-aborts ngrok/localhost). Commit `vapi.lock.json`.                                                                                                                                                                                                                                                                                 | Prod assistant updated with correct webhook URL.                                                                                |

---

### Workstream D — Cap & cost correctness

| #   | Task                                               | File:symbol                                                                              | Change                                                                                                                                                                                                                                      | Acceptance                                                                                                               |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| D1  | Onboarding cap exemption (BLOCKER before D2)       | `src/lib/config/voice.ts:39-64` `countVapiToday`/`VAPI_DAILY_CAP`; provider `:1253-1271` | `countVapiToday` counts every `voice_started(vapi)` incl onboarding; UX-12 says onboarding/check-ins must NOT consume the 5/day chat cap. Filter by surface/screen or use a separate cap so idle re-arms don't trip the cap mid-onboarding. | A full voice onboarding (incl idle re-arms) does not exhaust the 5/day cap; `voice_cap_reached` not fired by onboarding. |
| D2  | Revert test cap                                    | `voice.ts` (`VAPI_DAILY_CAP` test override 25; "Revert to 5 before launch")              | Revert to 5 **only AFTER D1**.                                                                                                                                                                                                              | Real cap active, onboarding unaffected.                                                                                  |
| D3  | **`maxDurationSeconds` (BLOCKER for one-session)** | Vapi dashboard                                                                           | A chat-oriented ~3-min cap on the shared assistant would kill a legit long single-session onboarding (UX-12 §4.5 exempts onboarding) and silently revert to many cold-starts. Confirm unset/large; record artifact.                         | Long single session not terminated mid-flow.                                                                             |
| D4  | `{{initial_screen_context}}` placeholder (BLOCKER) | Vapi dashboard                                                                           | Cold-start context is silently dropped if the placeholder is absent. Confirm it exists at the documented position; record artifact.                                                                                                         | Cold-start context lands on profile.                                                                                     |

---

### Workstream E — Quarantine the legacy step model

`useOnboardingChat` is still instantiated inside `OnboardingVoiceProvider` (`:1088`), and `onboardingChatCards.ts:149` still calls `beatForStep`, whose `SCREEN_TO_STEP` (`onboardingStepBeats.ts:84-103`) encodes a **contradictory** model for the same screenIds (`reflection=6`, `planReview=7`, no `morning`/`complete`).

| #   | Task                                                                           | File                                                          | Change                                                                                                                                                                                                                                                                                                    | Acceptance                                                                              |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| E1  | Reconcile or quarantine `beatForStep`/`SCREEN_TO_STEP` for now-armed screenIds | `onboardingStepBeats.ts:40-105`, `onboardingChatCards.ts:149` | Confirm card rendering for the armed beats does not read the contradictory legacy numbering (or fix it to the STEP-0 table). Watch for the reference branch's documented "wall-of-openers" dual-init bug — ensure Direct-LLM is fully suppressed on now-Vapi beats so two engines don't both own the mic. | Armed-beat cards render off the engine flow, not the legacy step map; no double opener. |

---

## 5. Per-Beat Arming Matrix

| screenId                | tool(s)                                     | Vapi handler | armed?                           | work needed                                    |
| ----------------------- | ------------------------------------------- | ------------ | -------------------------------- | ---------------------------------------------- |
| `ONBOARD-AUTH--FORM`    | —                                           | —            | **stays out**                    | pre-auth, no anonId                            |
| `MIC-PERMISSION`        | —                                           | —            | **stays out**                    | mic not yet granted                            |
| `ONBOARD-01--FORM`      | submit_profile                              | ✅           | armed today                      | reference beat                                 |
| `ONBOARD-FORK--FORM`    | submit_path_choice                          | ✅           | armed today                      | reference (proves intra-session handoff)       |
| `ONBOARD-BEGINNER-01`   | submit_category                             | ✅           | → arm (A1)                       | Set + RULE-2 row exist                         |
| `ONBOARD-BEGINNER-02`   | submit_goals                                | ✅           | → arm (A1)                       | Set only                                       |
| `ONBOARD-BEGINNER-03`   | add/remove_habit                            | ✅           | → arm (A1)                       | multi-item; advance via navigate_next(6)       |
| `ONBOARD-BEGINNER-04`   | update_habit                                | ✅           | → arm + **B6, C2 row**           | step-5 collision; cascades through tail        |
| `ONBOARD-ADVANCED`      | submit_brain_dump                           | ✅           | → arm + **C3**                   | crisis + unscrubbed-PII-on-Vapi gate           |
| `ONBOARD-BEGINNER-06`   | update_habit + navigate_next                | ✅           | → arm + **A6, B6**               | persistless engine-step 6; idle-pause risk     |
| `ONBOARD-MORNING-SETUP` | submit_morning_checkin                      | ❌ **build** | → arm + **B2-B4, C1-C2, A2, A4** | the real build                                 |
| `ONBOARD-BEGINNER-07`   | submit_reflection_config (+ custom_prompts) | ✅           | → arm + **C3**                   | crisis gate; reflection stays configurable     |
| `ONBOARD-COMPLETE`      | confirm_plan                                | ✅           | **recommend UNARMED (A8)**       | terminal/no-input; teardown race, zero benefit |

---

## 6. Latency & Cost

- **Latency:** first-audio p50 ~10–12s per `vapi.start()` (`useRealtimeVoice.ts:375+`). One session pays it once (masked by the instant Cartesia opener on profile); per-beat pays it 7–11×.
- **Cost / cap:** `countVapiToday` counts each `voice_started(vapi)`. One session = 1 unit; per-beat = N units — per-beat alone blows the real UX-12 cap of 5 mid-onboarding. The one-session model is the **only** model compatible with a 5/day cap, and only holds if D3/A6 keep it from fragmenting.
- **Premium minutes:** Vapi bills bundled STT+LLM+TTS per session-minute; model per-onboarding minutes before launch.
- **Measure (PostHog, segment onboarding vs chat):** `vapi_first_audio_ms`, `voice_started`, `voice_cap_reached`, `instant_opener_started`, idle-pause→resume count per onboarding, VAD endpointing dead-air (~1450ms default × ~11 beats), per-onboarding session minutes.

---

## 7. Testing Strategy

Setup: prod Supabase + `qa-onboarding` fixtures + reset; `VITE_ONBOARDING_USE_ENGINE=true`; `/onboarding-flow-preview` for auth-free QA; sync `--staging` before prod.

1. **STEP-0 instrumented trace (PRECONDITION, not a late test):** full Direct-LLM `advance_step` run through `ONBOARD-COMPLETE`; record entry step / target_step / sourceStep / data per beat → author the canonical table. Blocks B1, B6, C2, B5.
2. **Full Vapi walk (beginner):** AUTH(silent) → profile(instant opener, mic mute/unmute) → fork → category → goals → habits → schedule → plan-review → morning → reflection → (complete unarmed). Assert ONE session (single `voice_started`), warm openers via add-message, tool→Realtime→card auto-fill→advance per beat, clean teardown at reflection→complete (no coach audio into `/home`).
3. **Advanced lane:** profile → fork(advanced) → `ONBOARD-ADVANCED` → plan-review → … Assert the session survives the advanced fork (both fork lanes armed).
4. **Step-model walk:** assert server `current_step` climbs the **STEP-0 sequence (…5→6→7→8→9→10)** and `-03`→`-04`→`-06` advances without skip-guard rejection. (Do NOT assert the draft's 5→6→7→8 — it would pass a broken map / fail a correct one.)
5. **Per-beat fallback (UX-09, A3):** force fatal Vapi error / cap / cooldown mid-flow → beat degrades to Soniox→/api/llm half-duplex, remainder completes; a cooldown clearing mid-beat does NOT re-arm Vapi until next beat (latch).
6. **Crisis (BLOCKER):** self-harm utterance on `ONBOARD-ADVANCED` and `-07` → 988 boundary fires over Vapi (validates C3).
7. **Cap:** cap=5 + D1 → complete onboarding incl ≥1 idle re-arm → not locked out.
8. **Idle (A6, D3):** sit silent on plan-review/morning → session not torn down at 8s; long session not killed by `maxDurationSeconds`.
9. **No double-write regression:** assert the frontend never writes `current_step` on Vapi advances (the `applyAndAdvance(cap,false)` path) so navigate_next stays sole writer.
10. **Regression both lanes both paths:** B1 touches shared `checkAdvanceData` — run beginner AND advanced on BOTH Vapi and Direct-LLM. `npx tsc --noEmit`, `npx vitest run` (1301 baseline green).

---

## 8. Risks, Sequencing, Open Questions

**Sequencing (dependency-ordered):** 0. **STEP 0** — instrument Direct-LLM, author the canonical step table. Blocks 1.

1. **Pre-merge dashboard BLOCKERS** (Yair, §9): C3 (988+PII), D3 (`maxDurationSeconds`), D4 (`{{initial_screen_context}}`). Record artifacts.
2. **B1 + C2 as ONE atomic task** (shared numbering), B2–B4 (morning tool/handler/dispatch), B5, B6. Backend regression of the _current live_ Direct-LLM onboarding required — B1 is **not** a safe first step; a wrong remap breaks real users today.
3. **C1** (vapi:sync new tool) — needs B2.
4. **A4** (bundle), **A3** (UX-09 latch), **A5/A6** (wake-lock/idle), **E1** (legacy quarantine), **A8** (COMPLETE decision).
5. **A1 + A2** (widen Set) — LAST; arms everything once the above land.
6. **D1 then D2** (cap) — before launch.

**Top risks:**

- **Wrong shared-guard remap breaks live users** — B1 alters the Direct-LLM advance path _all current users_ hit, before any Vapi arming. Gate strictly on the STEP-0 table; full regression.
- **Off-by-one strands the tail** — the …5→6→7→8→9→10 climb with a shared step-5 and persistless 6; B1 and C2 must share one numbering.
- **Stranded-beat regression** — ship A3 (with latch) WITH A1, else one Vapi drop kills the whole remaining flow (blast radius grew from 2 beats to all).
- **Crisis + verbatim PII on Vapi** (highest severity) — C3 is a hard gate before `ONBOARD-ADVANCED`/`-07`.
- **One-session fragmentation** — D3 / A6 not satisfied silently reverts to many cold-starts and inverts the cap math.
- **Cap lockout** — reverting cap to 5 before D1.
- **Reference-branch myth** — `feat/onboarding-chat-vapi-fullduplex` has the SAME 2-beat Set; it is NOT a ready all-beats arming. Mine it for _how_, not for a finished list. Its bug doc warns of the dual-init "wall-of-openers" (E1).

**Open questions for the PO:**

- Confirm "every beat" = the post-mic-grant set (`AUTH` + `MIC-PERMISSION` stay out — anonId/mic gates make pre-grant Vapi impossible).
- **Arm `ONBOARD-COMPLETE` or leave it unarmed (recommended)?** Terminal, no input, teardown race for zero conversational benefit.
- Idle-pause: relax for the whole session, or only on read beats (A6 default)?
- Hard-gate the morning/reflection data preconditions in `checkAdvanceData`, or leave the later cases ungated (current `default→null`)?
- Does Vapi need real per-beat tool gating (`assistantOverrides.toolIds`) to match Direct-LLM's `allowedTools`, or is prompt-only RULE-2 discipline acceptable with all 13 tools live every turn?

---

## 9. Finish-with-Yair (Vapi dashboard — out-of-repo, PRE-MERGE BLOCKERS)

These are not "verify later" tasks — the one-session model and the safety boundary literally depend on them. Each needs a recorded verification artifact before merge.

1. **C3 — Crisis/988 + PII:** confirm the assistant prompt contains the 988/`SAFETY_OVERRIDE` block. Note that arming brain-dump + reflection moves the unscrubbed verbatim, highest-distress input onto the unsanitized Vapi path. **Hard gate for `ONBOARD-ADVANCED` + `-07`.**
2. **D3 — `maxDurationSeconds`:** confirm unset/large so a >3-min single-session onboarding isn't terminated (UX-12 §4.5 exempts onboarding). **Gate for the one-session model.**
3. **D4 — `{{initial_screen_context}}`:** confirm the placeholder exists at the documented position (else cold-start context is silently dropped).
4. **VAD endpointing:** confirm/lower the ~1450ms silence threshold to cut ~1s dead-air per turn across ~11 beats.
5. **Assistant identity:** confirm onboarding + chat share one `VITE_VAPI_ASSISTANT_ID` (so any chat-oriented dashboard cap couples to onboarding) — decide whether a separate onboarding assistant is warranted.

---

### Key file references

- Arming switch / legacy step model: `/Users/jonah/Documents/guided-growth-mvp/src/lib/onboarding/onboardingStepBeats.ts:20,40-105,113,127`
- Session lifecycle: `/Users/jonah/Documents/guided-growth-mvp/src/contexts/OnboardingVoiceProvider.tsx:1034,1088,1288-1340,1416-1437,296-339,1378-1414`
- Engine select / UX-09 (pure intent selector, latch needed): `/Users/jonah/Documents/guided-growth-mvp/src/lib/orb/engineForTurn.ts:5-7,42-56`
- Leading-edge engine + `beatStep` + `ENGINE_PERSISTLESS_STEP` + no-double-write: `/Users/jonah/Documents/guided-growth-mvp/src/onboarding-flow/useFlowOrchestrator.ts:18-51,171-178,243-269`
- Shared advance guard (header comment STALE): `/Users/jonah/Documents/guided-growth-mvp/api/_lib/llm/onboarding/preconditions.ts:1-2,14-46`, imported by `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/handlers/navigateNext.ts:34,121,134`
- confirm_plan stale text: `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/handlers/confirmPlan.ts:55,61,72`
- Morning build: `/Users/jonah/Documents/guided-growth-mvp/api/_lib/llm/tools.onboarding.ts`, NEW `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/handlers/submitMorningCheckin.ts`, `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/dispatch.ts:35-58`, port from `/Users/jonah/Documents/guided-growth-mvp/api/_lib/llm/onboarding/handlers/submitMorningCheckin.ts`
- Canonical flow (authoritative screenIds + persist steps): `/Users/jonah/Documents/guided-growth-mvp/src/onboarding-flow/flows/onboarding-beginner-v1.ts:34-403`
- Legacy quarantine consumer: `/Users/jonah/Documents/guided-growth-mvp/src/lib/onboarding/onboardingChatCards.ts:149`
- Vapi sync: `/Users/jonah/Documents/guided-growth-mvp/scripts/vapi-sync/sync.ts`, `/Users/jonah/Documents/guided-growth-mvp/scripts/vapi-sync/assistant.ts:46-58`
- Cap: `/Users/jonah/Documents/guided-growth-mvp/src/lib/config/voice.ts:39-64`
- Bundle: `/Users/jonah/Documents/guided-growth-mvp/src/generated/screen_contexts.json`
