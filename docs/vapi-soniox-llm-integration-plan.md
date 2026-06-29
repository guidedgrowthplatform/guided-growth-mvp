<!-- Generated 2026-06-26 by an 11-agent research workflow (run wf_26014260-d3b).
Branches of record: vapi-integration (base=vapi-base-2026-06-25), origin/engine-resync-v2 (canonical engine), fix/vapi-flow-onboarding (current Vapi stack). Reference-only, never merge: feat/onboarding-chat-vapi-fullduplex. -->

---

# Vapi + Soniox + Cartesia + LLM Integration Plan — Resynced Onboarding Engine (FINAL)

This plan assembles a single `vapi-integration` branch by merging the canonical resynced onboarding engine (`origin/engine-resync-v2`) with the current Vapi server/provider stack (`fix/vapi-flow-onboarding`), then closing a small, well-bounded set of parity and step-model gaps so that both voice paths — Path 1 (Vapi full-duplex on the armed beats) and Path 3 (Soniox→`/api/llm` Direct-LLM on every other beat) — drive the 11-beat engine spine identically through `onboarding_states.current_step`. The retired `feat/onboarding-chat-vapi-fullduplex` branch is reference-only and is **never** merged or relanded. The critical correction from research-and-review: a clean file-level merge will pass `tsc`/`build`/tests while the **new shared tail silently fails to advance under voice** — the real blockers are two frontend reconciliations (`serverCaptureForBeat` capture cases and the `beatStep`/`SCREEN_TO_STEP` step model), which gate **even the Direct-LLM path**, not just Vapi. Those are promoted to first-class, pre-voice-run workstreams below.

---

## 1. Executive Summary

### End state

One `vapi-integration` branch where the resynced engine (`src/onboarding-flow/*`) runs the full beginner spine — `ONBOARD-01--FORM → FORK → BEGINNER-01..03 → BEGINNER-04 (habit-schedule) → BEGINNER-06 (plan-cards) → MORNING-SETUP → BEGINNER-07 (reflection) → COMPLETE` — with voice advancing the engine through the `current_step ↔ Supabase Realtime ↔ orchestrator` loop on both paths. The Vapi webhook backend (`api/_lib/vapi/*`, `api/vapi/[...path].ts`, the `vapi_tool_calls` dedup ledger) reaches tool parity with the Direct-LLM onboarding tool set by gaining a `submit_morning_checkin` handler.

### The two real blockers (verified, frontend, path-agnostic)

1. **`serverCaptureForBeat` is missing 4 capture cases and the brain-dump capture is orphaned.** `src/onboarding-flow/useFlowOrchestrator.ts:53` switches on `node.componentType` with cases only for `profile-input / path-selection / category-grid / goals-list / habit-picker / reflection-card / coach-bubble`. The resync (`transform/designerToFlow.ts` `TYPE_TO_COMPONENT`, verified) introduces new componentTypes `habit-schedule`, `advanced-capture`, `morning-checkin-setup`, `plan-cards`, `into-app`. The `brainDumpText` capture is keyed to `coach-bubble`, but the brain-dump beat is now its own `advanced-capture` componentType (`designerToFlow.ts:51`, `:250-265`) — so on a voice advance the brain dump replays an **empty** capture and is silently dropped from the past-beat summary on **both** paths.
2. **The step model strands `plan-cards → morning-setup`.** `beatStep()` (`useFlowOrchestrator.ts:39-44`, verified) returns `node.persist.step` for persist nodes but falls back to `stepForScreenId(node.screenId)` for **persist-null** nodes (`plan-cards`, `into-app`). `SCREEN_TO_STEP` in `src/lib/onboarding/onboardingStepBeats.ts` was **not** touched by the resync (verified empty diff) and maps `ONBOARD-BEGINNER-06 → 7`, which **collides** with `morning-checkin-setup`'s `persist.step = 7` (`designerToFlow.ts:303`). The leading-edge rule advances only when `serverStep > thisStep` (`useFlowOrchestrator.ts:249`), so at plan-cards (`beatStep = 7`) a climb to `current_step = 7` (morning) yields `7 > 7 == false` → **no advance, stranded.** `SCREEN_TO_STEP` also has no entries for `ONBOARD-MORNING-SETUP` / `ONBOARD-COMPLETE` and a now-dead `ONBOARD-BEGINNER-07 → 6` (reflection is now a persist node at step 8).

### The core seam (already ~90% soldered)

`OnboardingVoiceProvider` (Vapi `@vapi-ai/web`) is mounted app-wide (`App.tsx`); `FlowOnboarding` routes inside it at `/onboarding/flow`. Two buses close the loop:

| Bus             | Direction      | Mechanism                                                                                                                                                                                                                                                      |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context bus** | engine → voice | `useFlowOrchestrator` calls `voice.registerScreen(node.screenId)` + `voice.setFormSnapshot(answers)` per beat → provider `pushScreenContext` → Vapi `client.send` add-message (Path 1) or Direct-LLM `screen_id` → `getBeatContext` (Path 3)                   |
| **Advance bus** | voice → engine | tool call → `onboarding_states.current_step` write (only `navigate_next`/`advance_step` writes it) → Supabase Realtime → `useOnboardingRealtimeSync` → `useFlowOrchestrator` leading-edge effect → `serverCaptureForBeat(...)` → `applyAndAdvance(cap, false)` |

The integration is therefore a **clean merge** plus a bounded fix set: the two frontend blockers above (WS-C/WS-F), the Vapi `submit_morning_checkin` handler for tool parity (WS-A/WS-B), stale step-directive strings in `confirmPlan.ts`, and a missing chunk-reveal test. It is **not** a rebuild and **never** a reland of the retired branch.

### Topology caveat that re-orders priority

Only **two** beats are armed for true Vapi full-duplex today — `CHAT_VAPI_BEAT_SCREENS = { ONBOARD-01--FORM, ONBOARD-FORK--FORM }` (`onboardingStepBeats.ts:21-22`, verified). Every other beat (incl. morning-setup, reflection, complete) runs Soniox→`/api/llm` Direct-LLM through the same provider, **where the `submit_morning_checkin` handler already exists** (`api/_lib/llm/onboarding/handlers/submitMorningCheckin.ts`, verified). So WS-A/WS-B (Vapi morning handler + dashboard registration) are **only load-bearing once a topology decision (C3) adds morning to the Vapi armed set** — they are parity/future-proofing, **not** the gate for a working voice run. The two frontend blockers gate every path and must land first.

---

## 2. Merge Mechanics

### Why clean — corrected file sets

`engine-resync-v2` touched only `src/onboarding-flow/*`, `api/_lib/llm/onboarding/*`, `componentRegistry.tsx`, `beatContexts.ts`, `packages/shared/src/types/index.ts`, and the separate check-in flows. `fix/vapi-flow-onboarding` (verified `git diff --stat` vs merge-base `e4d844d`, 21 files / +391/−127) touches:

```
api/_lib/db.ts                                  +8
api/_lib/vapi/dispatch.ts                       (26)
api/_lib/vapi/handlers/*.ts                     (12 handlers, incl. confirmPlan +11, navigateNext +11)
api/vapi/[...path].ts                           +152
src/contexts/OnboardingVoiceProvider.tsx        +82
src/hooks/useOnboardingRealtimeSync.ts          +35
src/hooks/useOnboardingRealtimeSync.staleGuard.test.ts   +24 (new)
src/onboarding-flow/renderer/BeatPlayer.tsx     +22
src/onboarding-flow/renderer/useCoachSpeechReveal.ts     +2
supabase/migrations/053_vapi_tool_dedup.sql     +20 (new)
```

**CORRECTION to the draft:** `fix` touches **zero** files under `src/lib/services/` (`cartesia-ws.ts`, `pcmPlayer.ts`, `tts-service.ts` are **not** in its diff — verified). Those service files (incl. the chunk-reveal commit `0557ec3`) already live on base/HEAD. The merge does **not** "carry a TTS/STT rewrite"; WS-D is rescoped to _verify base plumbing is intact_. `fix` **does** lightly touch `BeatPlayer.tsx` (+22) and `useCoachSpeechReveal.ts` (+2) — both also edited by the engine side conceptually, so watch those two for conflicts.

Disjoint backend file sets ⇒ predicted clean merge. The textual-overlap watch list is exactly: `BeatPlayer.tsx`, `useCoachSpeechReveal.ts` (both branches may touch), and the runtime-coupled `OnboardingVoiceProvider.tsx` / `useOnboardingRealtimeSync.ts` (only `fix` edits them, but they couple to the orchestrator `current_step` baseline at runtime — see WS-F risk).

### Exact sequence

```bash
git checkout vapi-integration
git log --oneline -1                       # == vapi-base-2026-06-25 (unified engine, 10 beats)

# 1. Land the canonical engine first (larger/structural change)
git merge origin/engine-resync-v2 --no-ff
#    Conflicts ONLY in src/onboarding-flow/* or api/_lib/llm/onboarding/* => base diverged, STOP.

# 2. Layer the Vapi server + provider hardening on top
git merge fix/vapi-flow-onboarding --no-ff
#    Plausible conflicts: BeatPlayer.tsx, useCoachSpeechReveal.ts (both branches touch).
#    OnboardingVoiceProvider.tsx / useOnboardingRealtimeSync.ts: textual-clean (only fix edits),
#    runtime-coupled — validate by voice run, not by tsc.
```

(Note: `fix/vapi-flow-onboarding` is a **local** branch, not `origin/` — verified.)

### Verify-after checklist

- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.
- [ ] `npx vitest run` — all green. **Vapi backend tests** under `api/_lib/vapi/__tests__/` = `handlers-reconcile.test.ts` only (verified). The reveal/gate/orb tests (`buildAssistantOverrides`, `vapiLiveGate`, `idleTimerGate`, `orbState`, `useOnboardingRealtimeSync.staleGuard`) live under `src/` — do not group them as backend tests.
- [ ] `git ls-tree -r HEAD -- api/_lib/vapi/handlers/` shows the 12 handlers + `dispatch.ts` + verifySecret/debug helpers.
- [ ] `supabase/migrations/053_vapi_tool_dedup.sql` present.
- [ ] `tsc -b packages/shared` emits `dist/` (postinstall); `morningCheckin` type present in `packages/shared/src/types/index.ts`.
- [ ] `componentRegistry.tsx` check-in adapter imports (`@/components/home`, `@gg/shared/types`) resolve.

---

## 3. Workstreams

Priority order (gate-first): **WS-C → WS-F (frontend blockers, gate every path) → WS-E (regression guards) → WS-A/WS-B (Vapi morning parity, gated by C3 topology) → WS-D (verify) → end-to-end voice pass.**

### WS-C — Frontend capture parity (engineer-owned, BLOCKER #1)

**C1. Add the missing `serverCaptureForBeat` cases + fix the orphaned brain dump**

- **File:** `src/onboarding-flow/useFlowOrchestrator.ts` (`serverCaptureForBeat`, the `switch (node.componentType)` at L56).
- **Change:** add cases:
  - `case 'habit-schedule':` → read `data.habitConfigs` → `BeatCapture` (`persistsFields: ['habitConfigs']`, `designerToFlow.ts:241`).
  - `case 'advanced-capture':` → read `data.brainDumpText` (`persistsFields: ['brainDumpText']`, `designerToFlow.ts:264`). **Move** the existing `brainDumpText` read off `case 'coach-bubble'` — `coach-bubble` is no longer in the spine, the brain-dump beat is `advanced-capture`. Keep `coach-bubble` as a no-op only if any non-spine beat still emits it.
  - `case 'morning-checkin-setup':` → read `data.morningCheckin` (`persistsFields: ['morningCheckin']`, `:300`).
  - `case 'plan-cards':` and `case 'into-app':` → no-op `{}` (both `persistsFields: []` / persist null, `:281`/`:340`).
- **Acceptance:** voice-advancing each new beat shows the captured value (`habitConfigs`, `brainDumpText`, `morningCheckin`) in the scrolled past-beat summary; `answers.brainDumpText` and `answers.morningCheckin` populate. See C5 for the parity test that prevents this class of bug recurring.

**C2. Confirm provider mount + per-beat context push (verification only)**

- **Files:** `src/App.tsx` (provider mount), `FlowOnboarding.tsx`, `useFlowOrchestrator.ts` (`registerScreen`/`setFormSnapshot`), `OnboardingVoiceProvider.tsx` (`pushScreenContext`).
- **Change:** none expected — verify the seam survives the merge: `registerScreen(node.screenId)` fires for the new beat ids, `pushScreenContext` dedupes on `lastPushedScreenIdRef`, and the floating overlay is suppressed on flow routes (page owns the orb via `FlowVoiceControls`). Do **not** cite a specific provider line number — `fix` added +82 lines, so any prior offset (e.g. "~L1356") is stale; locate the push effect by symbol.
- **Acceptance:** a beat transition logs a `client.send` add-message carrying the new screen's beat context.

**C3. `CHAT_VAPI_BEAT_SCREENS` topology decision (Yair, §7)**

- **File:** `src/lib/onboarding/onboardingStepBeats.ts:21-22` (currently `{ ONBOARD-01--FORM, ONBOARD-FORK--FORM }`).
- **Change:** decide whether MORNING-SETUP / COMPLETE / others join the Vapi-armed set or stay Direct-LLM/Soniox. **This decision gates whether WS-A/WS-B are load-bearing.**
- **Acceptance:** armed set matches product intent; `beatForStep` covers all armed step numbers.

**C4. Subtitles / mic lifecycle / keep-awake (verification)**

- **Files:** `OnboardingSubtitleBar.tsx`, `BeatPlayer.tsx`, `src/lib/services/keepAwake.ts`, `VoiceContext`.
- **Change:** verify the shared `transcriptBus` feeds `BeatPlayer`/`useCoachSpeechReveal` for both Vapi and Direct-LLM voice-in; keep-awake holds while `owner.kind !== 'idle'`; 8s idle auto-mute fires (UX-02/UX-16) **but** onboarding is exempt from the 3-min session cap and 5/day voice cap (UX-12) — confirm those caps are NOT applied to onboarding beats.
- **Acceptance:** mic stays hot across transitions; no sleep mid-session; no session/day cap on onboarding; idle auto-mute still conserves credits.

**C5. Capture-parity guard test (new)**

- **File (new):** `src/onboarding-flow/__tests__/serverCaptureForBeat.test.ts`.
- **Change:** assert that **every** `FlowNode` componentType in the generated flow with non-empty `tool.persistsFields` has a matching non-no-op `serverCaptureForBeat` case that round-trips the persisted data. This is the structural lock against the silent empty-replay class.
- **Acceptance:** test fails today (pre-C1), passes after C1; a future new componentType with `persistsFields` trips it.

### WS-F — Step-model reconciliation (engineer-owned, BLOCKER #2)

**F1. Reconcile `SCREEN_TO_STEP` / `beatForStep` with `ENGINE_BEAT_SPECS persist.step`**

- **File:** `src/lib/onboarding/onboardingStepBeats.ts` (`SCREEN_TO_STEP` L84-100, `beatForStep` L40-77, `stepForScreenId` L103-105).
- **Authoritative step model** (verified from `designerToFlow.ts` + generated JSON):

  | screenId                | componentType         | persist.step | beatStep source     | current SCREEN_TO_STEP                       |
  | ----------------------- | --------------------- | ------------ | ------------------- | -------------------------------------------- |
  | ONBOARD-01--FORM        | profile-input         | 1            | persist             | 1 ✅                                         |
  | ONBOARD-FORK--FORM      | path-selection        | 2            | persist             | 2 ✅                                         |
  | ONBOARD-BEGINNER-01     | category-grid         | 3            | persist             | 3 ✅                                         |
  | ONBOARD-BEGINNER-02     | goals-list            | 4            | persist             | 4 ✅                                         |
  | ONBOARD-BEGINNER-03     | habit-picker          | 5            | persist             | 5 ✅                                         |
  | ONBOARD-BEGINNER-04     | habit-schedule        | 5            | persist             | (absent — OK, persist used)                  |
  | ONBOARD-ADVANCED        | advanced-capture      | 3            | persist             | 3 ✅                                         |
  | **ONBOARD-BEGINNER-06** | **plan-cards**        | **null**     | **stepForScreenId** | **7 ❌ collides w/ morning(7)**              |
  | ONBOARD-MORNING-SETUP   | morning-checkin-setup | 7            | persist             | (absent — OK, persist used)                  |
  | ONBOARD-BEGINNER-07     | reflection-card       | 8            | persist             | 6 (dead — persist overrides; fix for path-3) |
  | **ONBOARD-COMPLETE**    | **into-app**          | **null**     | **stepForScreenId** | **absent → undefined (terminal, OK)**        |

- **Change:**
  - Set `SCREEN_TO_STEP['ONBOARD-BEGINNER-06'] = 6` (must be **strictly below** morning's `7`) so a climb to `current_step = 7` makes `7 > 6` fire the plan-cards→morning advance. This is the single confirmed strand-fix.
  - Correct the dead `ONBOARD-BEGINNER-07 → 6` to `8` (reflection persist.step) so the **Direct-LLM** `beatForStep`/chat-card resolution agrees with the engine (closes the path-divergence in §4). For voice advance `beatStep` already uses `persist.step` here; this is for the Direct-LLM card-resolution lane.
  - Leave `ONBOARD-COMPLETE` out of `SCREEN_TO_STEP` (terminal; `beatStep` undefined → no auto-advance; completion is via `confirm_plan` → `status='complete'`). Verify the orchestrator picks up `status='complete'` from the server row.
  - Update `beatForStep` (`onboardingStepBeats.ts:40-77`) to add the new-tail screen ids if the Direct-LLM lane resolves cards from it.
- **Acceptance:** the plan-cards→morning→reflection→complete voice walk advances monotonically (no strand); `beatForStep`/`stepForScreenId` agree with `persist.step` for every shared screen id.

**F2. Step-parity test (new)**

- **File (new):** `src/lib/onboarding/__tests__/stepModelParity.test.ts`.
- **Change:** assert, over the generated flow: (a) every **persist** node has `persist.step == stepForScreenId(screenId)` (or that `beatStep` reads `persist.step`); (b) every **persist-null** node has a defined `stepForScreenId` that is **strictly less** than the next downstream beat's step (so the leading-edge climb can fire), except the terminal `into-app`.
- **Acceptance:** fails on the BEGINNER-06=7 collision today; passes after F1.

**F3. End-to-end advance assertion (manual or harness)**

- Assert `current_step` actually climbs past each new-tail beat's `beatStep` threshold under voice — the leading-edge climb (not the tool write) is where the spine breaks, and `tsc`/`build`/clean-merge all pass while the tail silently strands.

### WS-A — Vapi backend parity (engineer-owned; load-bearing ONLY if C3 arms morning for Vapi)

**A1. `submit_morning_checkin` Vapi handler**

- **File (new):** `api/_lib/vapi/handlers/submitMorningCheckin.ts`.
- **Change:** mirror `api/_lib/vapi/handlers/submitReflectionConfig.ts`: signature `(args, db: Queryable = pool)`; UUID-validate embedded `anon_id`; validate `time` (HH:MM), `days` (ints 0-6 dedup+sort), `reminder` (bool coercion), `schedule ∈ SCHEDULE_OPTIONS`; reconcile `schedule = inferSchedule(days) ?? scheduleRaw`; persist `data.morningCheckin` via `INSERT ... ON CONFLICT (anon_id) DO UPDATE SET data = data || $payload`; **INSERT-branch default `current_step = 7`** (matches `api/_lib/llm/onboarding/handlers/submitMorningCheckin.ts` line 57-58, `VALUES ($1, 7, ...)`, verified); **DATA-ONLY on UPDATE** (do not write `current_step` — `navigate_next` owns advance). Validation must match the Direct-LLM handler exactly.
- **Dependencies:** `inferSchedule`, `SCHEDULE_OPTIONS` from `api/_lib/llm/tools.onboarding.ts`.
- **Acceptance:** unit test in `handlers-reconcile.test.ts` covering days-authoritative schedule re-derivation; `{result}` on valid, `{error}` on bad input; concurrent same-batch write coalesces into one Realtime event via the dedup ledger.

**A2. Register handler in the Vapi dispatcher**

- **File:** `api/_lib/vapi/dispatch.ts`.
- **Change:** `import { submitMorningCheckin }` + `case 'submit_morning_checkin': return submitMorningCheckin(args, db);`
- **Acceptance:** `git grep "submit_morning_checkin" api/_lib/vapi/dispatch.ts` hits; no longer returns `unknown_tool`.

**A3. Step-number + recovery-directive audit on the Vapi handlers**

- **Files:** `api/_lib/vapi/handlers/navigateNext.ts`, `api/_lib/vapi/handlers/confirmPlan.ts`, all `submit*` INSERT-default seeds, `api/_lib/llm/onboarding/preconditions.ts:checkAdvanceData`.
- **Change:**
  - **`navigateNext.ts`:** `MAX_STEP = 10` (verified) — **already sufficient** for the longer tail (reflection=8 → into-app needs target_step=9). No ceiling change needed; the draft's worry here is resolved. Re-verify the **+2 skip guard** (`navigate_next rejected reason=cannot_skip_steps`, L104-126) does not reject the legitimate one-step climbs across the new tail.
  - **`confirmPlan.ts` recovery directive strings (L55-64) are STALE and will mis-steer the model.** They say `navigate_next(target_step=7)`, `"Do NOT retry confirm_plan until current_step is 7"` — written when reflection was the gating step. In the resync spine reflection is **step 8** and sits **after** morning (step 7). Update the natural-language directives to reference the correct terminal: reflection saved at step 8, then `navigate_next(target_step=9)` into `ONBOARD-COMPLETE`, and gate `confirm_plan` to fire only at COMPLETE. The completion write `current_step = GREATEST(onboarding_states.current_step, 8)` (L72) and the `>7` threshold comment (L3-4) still functionally complete both lanes, but update the comment to reflect the morning(7)→reflection(8) ordering.
  - Cross-check `submitMorningCheckin` (7) vs `submitReflectionConfig` INSERT defaults against `persist.step` (morning=7, reflection=8). Document any legacy-fallback drift.
- **Acceptance:** a Vapi walk through the beginner tail advances monotonically; `confirm_plan` fired at plan-review returns `confirm_plan_too_early` (its precondition `hasReflection` is false there because reflection comes after morning — order-safe), and succeeds only at COMPLETE.

**A4. `advance_step` vs `navigate_next` verb reconciliation**

- **Files:** `api/_lib/vapi/dispatch.ts` (has `navigate_next`), `api/_lib/llm/onboarding/handlers/advanceStep.ts` (Direct-LLM `advance_step`, **shares** navigateNext logic per its header comment), `beatContexts.ts` `allowedTools` (reference `advance_step`), Vapi dashboard prompt (WS-B).
- **Change:** keep the Vapi advance tool as `navigate_next` and author the Vapi system prompt to use it. `beatContexts.allowedTools` gates only the Direct-LLM path; the Vapi path is gated by the dashboard tool list — no registry conflict. Document this split. (Alternative: add an `advance_step → navigateNext` alias case; not recommended — extra surface.)
- **Acceptance:** BEGINNER-06→morning and morning→reflection→COMPLETE transitions fire under Vapi without the LLM emitting an unregistered tool name.

### WS-B — Vapi assistant config + tool registration (collaborative — dashboard external; gated by C3)

**B1. Register `submit_morning_checkin` on the assistant**

- **Files:** `api/_lib/llm/tools.onboarding.ts` (schema source consumed by `scripts/vapi-sync`), `scripts/vapi-sync/sync.ts`, `vapi.lock.json`.
- **Change:** add `submit_morning_checkin` schema (`time, days, reminder, schedule` enum = SCHEDULE_OPTIONS) to `ONBOARDING_TOOLS`; re-run `scripts/vapi-sync/sync.ts` (webhook `server.secret`); commit updated `vapi.lock.json`.
- **Dependency:** A1/A2.
- **Acceptance:** `vapi.lock.json` lists the new tool; `mcp__vapi__list_tools` shows `submit_morning_checkin` bound to `/api/vapi/tool`.

**B2. Expose `mode` on `submit_reflection_config`**

- **Files:** `api/_lib/llm/tools.onboarding.ts`, then `scripts/vapi-sync`.
- **Change:** add optional `mode` enum `['prompts','freeform']`. The server handler `submitReflectionConfig.ts` **already reads it** (verified ~L109-115) — only the LLM-facing schema is missing, so the reflection STYLE never reaches the Vapi path today.
- **Acceptance:** reflection style persists as `reflectionMode` from a Vapi turn.

**B3. `submit_custom_prompts` DATA-side parity + system-prompt hygiene**

- **Files:** `api/_lib/llm/tools.onboarding.ts` (confirm `submit_custom_prompts` schema is registered on the Vapi assistant), Vapi dashboard prompt (external), `{{initial_screen_context}}` placeholder.
- **Change:**
  - **Parity check:** confirm the Vapi assistant emits `submit_custom_prompts` when the user authors prompts. There is **no server-side fallback** — if the assistant never calls it, custom prompts authored in the reflection card are dropped on the Vapi path. Add to the dashboard prompt's reflection beat instructions and verify with a live call.
  - Confirm prompt contains `{{initial_screen_context}}` (else context injection silently no-ops → static firstMessage).
  - Verify block order: `CORE_IDENTITY → CRISIS_BOUNDARY (must stay above) → RESPONSE_RULES → COACHING_STYLES → voice rules`; Rule #8 (988 crisis) reachable with no session cap.
  - Confirm `confirm_plan` is gated to COMPLETE in the prompt (defense-in-depth on top of the handler precondition).
- **Dependency:** A3, A4, B1, B2.
- **Acceptance:** Yair-side dashboard review; crisis utterance yields the 988 hard-escape; custom prompts persist from a Vapi turn; `confirm_plan` never fires before morning+reflection collected.

**B4. Seed `screen_contexts` for new + re-purposed beats**

- **Files:** `scripts/voice-sync/seed_contexts.py` / Supabase `screen_contexts`.
- **Change:** seed/refresh rows for `ONBOARD-MORNING-SETUP`, `ONBOARD-COMPLETE`, **and `ONBOARD-BEGINNER-04` (re-purposed to habit-schedule)** — the backend `api/_lib/llm/buildSystemPrompt.ts` and the Vapi `get_user_context` tool read `screen_contexts` from the DB. Code defaults in `beatContexts.ts` are already live for the Direct-LLM path; this is DB-side parity for the Vapi backend reads.
- **Acceptance:** `SELECT screen_id FROM screen_contexts WHERE screen_id IN ('ONBOARD-MORNING-SETUP','ONBOARD-COMPLETE','ONBOARD-BEGINNER-04')` returns 3 rows in prod with the resync's content.

### WS-D — STT (Soniox) + TTS (Cartesia) correctness (rescoped: verify, do not "carry a rewrite")

**D1. Confirm base TTS/STT plumbing intact post-merge (verification)**

- **CORRECTION:** neither branch rewrites `src/lib/services/{cartesia-ws,pcmPlayer,tts-service}.ts` — verified `fix` touches none of them; they already live on base/HEAD. `fix` only touches `BeatPlayer.tsx` (+22) and `useCoachSpeechReveal.ts` (+2) on the renderer side.
- **Change:** verify the new beat adapters (`MorningCheckinAdapter`, `IntoAppAdapter`, `CoachBubbleAdapter`, `ReflectionSayAdapter`) render through `BeatView → BeatPlayer → Karaoke` and speak coach lines via `useOnboardingChat`'s `beginSpeechTurn / pushSpeechChunk`. Confirm intentionally-silent beats (`into-app` / AutoAdvance) do NOT speak.
- **Acceptance:** new adapters speak with chunk reveal; silent beats stay silent.

**D2. Voice ID parity (Path-1 handoff)**

- **File:** `api/cartesia-tts.ts` `DEFAULT_VOICE_ID` (`104635f9-8991-403c-9988-bc5b70b39939`) must equal the Vapi assistant's configured Sonic voice.
- **Acceptance:** opener→Vapi handoff is seamless (no timbre change).

**D3. Cartesia model decision (sonic-3 vs sonic-3.5)** — OPEN, Yair (§7)

- `api/cartesia-tts.ts` uses `sonic-3.5-2026-05-04`; coach/check-in locked to sonic-3; global-ux says Sonic 3.5. Confirm the Vapi assistant's model and align the REST proxy for opener parity.

**D4. Cartesia 401-only backoff** — OPEN, Yair (§7, crosses check-in owner)

- **File:** `src/lib/services/tts-service.ts` `synthChunk` — currently `if (res.status === 401) cartesiaTtsAvailable = false;` (narrowed from 429/401/500 in commit `2a5b8e4`). A sustained 429 (quota) no longer disables TTS → every chunk hammers `/api/cartesia-tts`, returns null, coach goes silently mute until a gesture re-unlocks.
- **Recommendation:** re-add a **transient 429/5xx soft-backoff** (skip-and-retry-next-turn, no permanent disable) distinct from the 401 hard-disable, so quota outages degrade visibly. Coordinate with the check-in owner before touching shared `tts-service.ts`.
- **Acceptance:** sustained 429 surfaces a degraded flag, not silent mute; 401 still hard-disables + recovers on gesture.

**D5. The MISSING chunk-reveal test**

- **Files (new):** `src/lib/services/__tests__/tts-service.test.ts` (chunked-queue coverage), `src/onboarding-flow/renderer/__tests__/useCoachSpeechReveal.test.ts` (add `// @vitest-environment jsdom`).
- **Change:** test `beginSpeechTurn / pushSpeechChunk / endSpeechTurn` + per-chunk `onReveal` (the chunk-level karaoke reveal from commit `0557ec3` has no test); test `useCoachSpeechReveal` word/window/fallback mode selection and the per-word↔speech-window handoff. Update the **stale doc comments** in `useCoachSpeechReveal.ts` / `tts-service.ts` that still describe the obsolete Cartesia-WebSocket per-word timestamp mechanism.
- **Acceptance:** new tests green; per-chunk vs per-word granularity locked by assertion.

### WS-E — Direct-LLM + Async-path regression guard

**E1. Direct-LLM path unchanged (verification)**

- **Files:** `api/llm/[...path].ts`, `api/_lib/llm/buildSystemPrompt.ts` — both UNCHANGED by resync. Confirm `isOnboardingScreen` (`startsWith('ONBOARD-')`) recognizes `ONBOARD-MORNING-SETUP` / `ONBOARD-COMPLETE` / `ONBOARD-BEGINNER-04` (by prefix) → raw-text carve-out (no `scrubPII`) + `getBeatContext` + `stripForwardPointers` + `NO_PRENARRATION`.
- **Critical guard (CLAUDE.md #10):** Vapi (Path 1) must **NOT** route through `stripForwardPointers` — it needs raw forward pointers to drive navigation. The QA "Vapi missing stripForwardPointers" finding is **reconciled** as: the real fix is verb naming (A4), NOT applying the stripper to Vapi. Do not gate or move `stripForwardPointers`.
- **Acceptance:** Direct-LLM onboarding on the new beats fires `submit_morning_checkin` / `confirm_plan`, writes `current_step`, advances the engine; no pre-narration leak; Vapi still sees raw forward pointers.

**E2. Dual-dispatcher drift guard**

- **Issue:** `api/_lib/vapi/dispatch.ts` and `api/_lib/llm/onboarding/dispatch.ts` are hand-synced with no shared registry; the `submit_morning_checkin` gap is the live demonstration.
- **Change:** add a 2-line cross-pointer comment in BOTH dispatch files, and a test asserting the Vapi dispatch tool set ⊇ the Direct-LLM onboarding tool set (or documents intentional differences).
- **Acceptance:** a future tool added to one dispatcher trips the parity test.

**E3. Check-in flow isolation (do-not-touch)**

- The resync's check-in adapters (`state-check`, `habit-review`, `reflection` say-only) and `flows/checkin-flows.ts` land in shared `componentRegistry.tsx` but are a separate Path-2 async flow owned by the check-ins zone. Verify they compile; do **not** wire them into the Vapi onboarding path.
- **Acceptance:** check-in adapters compile; onboarding Vapi dispatch has no check-in tool cases.

---

## 4. Per-Beat Parity Matrix (authoritative — from `designerToFlow.ts` + generated JSON, verified)

| screenId              | componentType             | persist.step | Tool                                                    | Direct-LLM handler | Vapi handler                     | serverCapture case                   | Notes                                                           |
| --------------------- | ------------------------- | ------------ | ------------------------------------------------------- | ------------------ | -------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| ONBOARD-01--FORM      | profile-input             | 1            | submit_profile                                          | ✅                 | ✅                               | ✅ profile-input                     | Vapi-armed                                                      |
| ONBOARD-FORK--FORM    | path-selection            | 2            | submit_path_choice                                      | ✅                 | ✅                               | ✅ path-selection                    | Vapi-armed                                                      |
| ONBOARD-BEGINNER-01   | category-grid             | 3            | submit_category                                         | ✅                 | ✅                               | ✅ category-grid                     |                                                                 |
| ONBOARD-BEGINNER-02   | goals-list                | 4            | submit_goals                                            | ✅                 | ✅                               | ✅ goals-list                        |                                                                 |
| ONBOARD-BEGINNER-03   | habit-picker              | 5            | add_habit                                               | ✅                 | ✅                               | ✅ habit-picker                      |                                                                 |
| ONBOARD-BEGINNER-04   | **habit-schedule**        | 5            | update_habit                                            | ✅                 | ✅                               | **❌ add case (C1)**                 | re-purposed beat; needs screen_contexts seed (B4)               |
| ONBOARD-ADVANCED      | **advanced-capture**      | 3            | submit_brain_dump                                       | ✅                 | ✅                               | **❌ orphaned to coach-bubble (C1)** | brain dump silently lost on both paths                          |
| ONBOARD-BEGINNER-06   | **plan-cards**            | null         | update_habit + navigate                                 | ✅                 | ✅                               | **❌ add no-op (C1)**                | **beatStep collides w/ morning(7) → F1 fix**                    |
| ONBOARD-MORNING-SETUP | **morning-checkin-setup** | 7            | submit_morning_checkin                                  | ✅                 | **❌ A1/A2 (+B1 if Vapi-armed)** | **❌ add case (C1)**                 | new beat; B4 seed                                               |
| ONBOARD-BEGINNER-07   | reflection-card           | 8            | submit_reflection_config (+mode), submit_custom_prompts | ✅ (reads `mode`)  | ✅ (reads `mode`)                | ✅ reflection-card                   | dashboard schema needs `mode` (B2) + custom_prompts parity (B3) |
| ONBOARD-COMPLETE      | **into-app**              | null         | confirm_plan                                            | ✅                 | ✅                               | **❌ add no-op (C1)**                | terminal; A3 re-gate completion + directive strings             |

**Bottom line:** the only **new Vapi handler** needed is `submitMorningCheckin` (A1/A2) — and that is gated by the C3 topology decision. The **path-agnostic blockers** are C1 (5 capture cases incl. orphaned brain dump) and F1 (BEGINNER-06 step collision). Everything else is config (B1-B4), directive fixes (A3), verb split (A4), and tests.

---

## 5. Testing Strategy

**Environment:** prod Supabase project (confirm the exact project ref directly in env before pointing fixtures — the draft's `pmunbflbjpoawicgimyc` appeared twice identically, so it is effectively unverified; read `SUPABASE_URL` from the deploy env). Use `qa-onboarding-*` fixtures + reset endpoint; set `VITE_ONBOARDING_USE_ENGINE=true`.

**Pre-flight (or the stack 500s):**

- [ ] Apply `supabase/migrations/053_vapi_tool_dedup.sql` — every tool call INSERTs into `vapi_tool_calls`; un-applied ⇒ batch 500s ⇒ Vapi retries.
- [ ] Seed `screen_contexts` for the 3 beats (B4).
- [ ] If C3 arms morning for Vapi: re-run `scripts/vapi-sync/sync.ts` (B1/B2); confirm `vapi.lock.json` points at the **prod** webhook, not a dev ngrok tunnel (heed the sync hard-abort guard).
- [ ] Vapi env: `VITE_VAPI_PUBLIC_KEY`, `VITE_VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Routes:** `/onboarding/flow` (real engine, under `AppGate allow="onboarding-or-public"`); `/onboarding-flow-preview` (Yair-facing preview).

**Test passes (each on a fresh `qa-onboarding-*` reset):**

1. **Direct-LLM voice (default topology, GATING):** Soniox voice-in through all beats incl. brain-dump, habit-schedule, morning-setup, complete; assert `current_step` advances monotonically AND `answers.brainDumpText` / `answers.habitConfigs` / `answers.morningCheckin` render in the summary (C1) AND plan-cards→morning does not strand (F1). This pass proves the two blockers independent of Vapi.
2. **Vapi full-duplex (armed beats):** ONBOARD-01 + FORK with `ONBOARDING_CHAT_VAPI` on; assert magic-moment name-back, real-time form auto-fill via Realtime, batched write at navigate.
3. **Vapi backend unit:** `handlers-reconcile.test.ts` extended for `submitMorningCheckin` (A1); dedup-ledger replay test for a `navigate_next` retry (must not shove the user backward).
4. **Capture + step parity:** `serverCaptureForBeat.test.ts` (C5) + `stepModelParity.test.ts` (F2).
5. **TTS reveal:** `tts-service.test.ts` + `useCoachSpeechReveal.test.ts` (D5).
6. **Fallback (UX-09):** mic denied / Vapi init error on each beat → silent form completion by tap, no data loss, `voice_init_failed` logged.
7. **Crisis:** 988 hard-escape inside the Vapi loop, no session cap.

**"Preview for Yair" must demonstrate:** the ONBOARD-01 magic moment (cloned-voice name-back, real-time auto-fill) under Vapi; a clean voice walk through the new shared tail (plan-review → morning-setup → reflection-with-style-picker → complete) advancing without strand; `confirm_plan` firing only at COMPLETE; graceful degrade to tap/text on a mic-denied beat.

---

## 6. Known Issues

| #   | Issue                                                                                                                                             | Disposition                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `serverCaptureForBeat` missing 4 cases + orphaned `brainDumpText` (was `coach-bubble`, now `advanced-capture`)                                    | **BLOCKER — WS-C1/C5.** Silent empty-replay on both paths.                                                                                                                                                            |
| 2   | `SCREEN_TO_STEP['ONBOARD-BEGINNER-06']=7` collides with morning persist.step=7; no entries for MORNING-SETUP/COMPLETE; dead BEGINNER-07=6         | **BLOCKER — WS-F1/F2.** plan-cards→morning strands.                                                                                                                                                                   |
| 3   | `confirmPlan.ts` recovery directive strings (L55-64) stale (`target_step=7`, "until current_step is 7") for the morning(7)→reflection(8) ordering | **WS-A3.** Mis-steers the Vapi model.                                                                                                                                                                                 |
| 4   | 3 legacy ungated screens ADVANCED-03 / BEGINNER-08 / BEGINNER-09                                                                                  | NOT v2 beats — legacy-flow note, **not engine work.** Do not gate as part of this integration.                                                                                                                        |
| 5   | Beat-content Supabase sync not run for new + re-purposed beats                                                                                    | **WS-B4.** Direct-LLM uses live `beatContexts.ts` defaults; Vapi backend reads `screen_contexts` from DB → seed MORNING-SETUP, COMPLETE, BEGINNER-04.                                                                 |
| 6   | TTS 401-only backoff (sustained 429 → silent mute)                                                                                                | **WS-D4** — re-add transient 429/5xx soft-backoff; coordinate with check-in owner.                                                                                                                                    |
| 7   | Missing chunk-reveal test + stale doc comments                                                                                                    | **WS-D5.**                                                                                                                                                                                                            |
| 8   | `submit_custom_prompts` no server-side fallback on Vapi path                                                                                      | **WS-B3** — dashboard prompt must reliably emit it.                                                                                                                                                                   |
| 9   | `canonicalOptions.ts` possible stale "collect all four" block (contradicts ONBOARD-01 = age+gender only)                                          | Verify on merged tree; if present, fix the Direct-LLM prompt source. Flag if it surfaces in a Vapi run.                                                                                                               |
| 10  | `MAX_STEP` ceiling for the longer tail                                                                                                            | **No fix needed** — `navigateNext.ts:38` `MAX_STEP=10` (verified) already covers target_step 9 (reflection→complete). Draft's worry resolved; only the directive strings (#3) and +2 skip guard need re-verification. |

---

## 7. Risks, Sequencing, Open Questions

### Sequencing (gate-first, strict)

1. Merge engine-resync-v2 → fix/vapi-flow-onboarding (§2).
2. **WS-C1 + WS-F1** (the two blockers) + their parity tests C5/F2 — **before any voice run.**
3. Apply migration 053 + seed `screen_contexts` (B4).
4. E2 + D5 (guards/tests).
5. **Direct-LLM voice pass (Test #1)** — proves the spine advances end-to-end without Vapi.
6. C3 topology decision (Yair). **Only if morning is armed for Vapi:** A1/A2 (handler+dispatch), A3 (directives), A4 (verb split), B1/B2/B3 (dashboard), re-run vapi-sync.
7. End-to-end Vapi voice pass (file-level merge cleanliness does NOT prove behavioral compatibility — both branches exercise the `current_step ↔ Realtime ↔ orchestrator` loop at runtime).

### Top risks

- **Silent empty-replay (C1)** and **plan-cards strand (F1):** `tsc`/`build`/clean-merge all pass while the tail loses data / fails to advance. Caught only by Test #1 + C5/F2.
- **`useOnboardingRealtimeSync` staleGuard (fix branch) timing** could shift when `current_step` climbs reach the orchestrator's leading-edge baseline → beat fails to advance or double-advances. **Validate by manual voice run**, not `tsc`/`build`.
- **Migration 053 hard dependency** — un-applied ⇒ every tool call 500s.
- **Dual-dispatcher drift (E2)** — `submit_morning_checkin` is the live example.
- **Dashboard `{{initial_screen_context}}` placeholder missing** ⇒ context injection silently no-ops to static firstMessage.
- **vapi-sync pointing prod tools at a dev tunnel** — heed the hard-abort guard.
- **Latency reality** — Vapi first-audio p50 ~10-12s in every region incl. localhost (architectural). VAD endpointing (~1450ms default) and Soniox temp-key pre-warm (on chat-screen open) are the tuning knobs.

### Open questions for Yair

1. **Vapi-armed topology (C3):** stay at 2 beats (ONBOARD-01, FORK) with everything else Direct-LLM/Soniox, or arm MORNING-SETUP/COMPLETE/others? **Determines whether WS-A/WS-B are load-bearing.**
2. **Cartesia model (D3):** sonic-3 vs sonic-3.5 for the onboarding Vapi assistant + REST opener parity.
3. **TTS backoff (D4):** OK to add a transient 429/5xx soft-backoff for onboarding (crosses the check-in owner's phase-1 change)?
4. **Pronunciation persistence (ONBOARD-01, Yonas-owned):** does Vapi carry `name_pronunciation_guide` / `name_spelling_override` across sessions, or read from `user_profile` and re-inject every screen?
5. **Branch/mirror drift:** which engine tree is canonical for incoming flow-builder MRs, and who re-runs `flow:sync` to close the stale `transform/designerSource.ts` mirror?

---

## 8. Finish-Together With Yair

- **B1/B2/B3 — Vapi dashboard assistant config:** tool registration (`submit_morning_checkin`, `mode` param, `submit_custom_prompts` emission), `{{initial_screen_context}}` verification, CRISIS_BOUNDARY ordering, `confirm_plan` gated to COMPLETE. Dashboard is external — pair on the push + a live test call. (Gated by C3.)
- **C3 — Vapi-armed beat topology:** product decision on how much of the flow runs true Vapi full-duplex vs Direct-LLM.
- **D3 — Cartesia model** and **D4 — TTS backoff** (touches the check-ins owner's `tts-service.ts`; coordinate before altering shared code).
- **Open Q4 — pronunciation persistence** (Yonas-owned ONBOARD-01 spec item).
- **The end-to-end voice run-through** (§7 steps 5 & 7): the only real proof the merge is behaviorally sound — watch the magic-moment beat and the new shared tail (plan-review → morning-setup → reflection-style-picker → complete) advance by voice without strand.

**Plan files of record (absolute):**

- `/Users/jonah/Documents/guided-growth-mvp/src/onboarding-flow/useFlowOrchestrator.ts` (C1 — serverCaptureForBeat cases; beatStep at L39-44)
- `/Users/jonah/Documents/guided-growth-mvp/src/lib/onboarding/onboardingStepBeats.ts` (F1 — SCREEN_TO_STEP/beatForStep)
- `/Users/jonah/Documents/guided-growth-mvp/src/onboarding-flow/transform/designerToFlow.ts` (authoritative ENGINE_BEAT_SPECS: persist.step + componentTypes)
- `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/handlers/submitMorningCheckin.ts` (A1 — new)
- `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/dispatch.ts` (A2)
- `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/handlers/confirmPlan.ts` (A3 — stale directive strings L55-64)
- `/Users/jonah/Documents/guided-growth-mvp/api/_lib/vapi/handlers/navigateNext.ts` (A3 — MAX_STEP=10, +2 skip guard)
- `/Users/jonah/Documents/guided-growth-mvp/api/_lib/llm/onboarding/handlers/submitMorningCheckin.ts` (Direct-LLM reference for A1)
- `/Users/jonah/Documents/guided-growth-mvp/api/_lib/llm/tools.onboarding.ts` (B1/B2 — schemas)
- `/Users/jonah/Documents/guided-growth-mvp/src/lib/services/tts-service.ts` (D4/D5 — base file, NOT rewritten by fix)
- `/Users/jonah/Documents/guided-growth-mvp/supabase/migrations/053_vapi_tool_dedup.sql` (pre-flight)
