# Arm All Beats for Vapi Full-Duplex — Deep Plan (v2)

**Goal:** make Vapi a single continuous full-duplex session for the WHOLE onboarding journey — coach speaks the opener, listens, fills fields, calls the tool, navigates — replicating what now works on **profile → fork**, for every remaining beat.

**Status as of this plan (verified live 2026-06-27):**

- ✅ profile (`ONBOARD-01--FORM`) and fork (`ONBOARD-FORK--FORM`) work end-to-end over Vapi.
- ✅ Realtime side-channel mounted in the engine (`FlowOnboarding`), so server writes reach the UI.
- ✅ Idle auto-pause is env-configurable (`VITE_ONBOARDING_VAPI_IDLE_TIMEOUT_MS`) — Vapi stays live during testing.
- ✅ `[vapi-gate]` diagnostic names which gate condition drops a call.
- ✅ **Fork routing bug fixed** — `onboarding_states.path` (its own column) is now merged into the capture data, so the fork resolves its lane instead of jumping to the merge node (plan review).

---

## 1. How "armed" is defined (the contract per beat)

A beat is Vapi-armed when ALL of these hold (profile/fork already satisfy them):

| Dimension                           | Where                                                            | Why                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **In `CHAT_VAPI_BEAT_SCREENS`**     | `src/lib/onboarding/onboardingStepBeats.ts`                      | Keeps `vapiCapableBeat=true` → `engine='vapi'` → `vapiShouldBeLive` stays true (no teardown leaving the beat) |
| **Context block + forward pointer** | `src/generated/screen_contexts.json` (Vapi)                      | Vapi needs `NEXT:`/arrow pointers to drive `navigate_next`                                                    |
| **Tool + handler + dispatch**       | `tools.onboarding.ts`, `api/_lib/vapi/handlers/*`, `dispatch.ts` | Persist the answer server-side                                                                                |
| **Advance precondition**            | `api/_lib/llm/onboarding/preconditions.ts` (`checkAdvanceData`)  | Gate `navigate_next` until the field is saved                                                                 |
| **Adapter + realtime reflection**   | `componentRegistry.tsx`                                          | Render the card; reflect the saved value (via realtime cache)                                                 |
| **`serverCaptureForBeat` case**     | `useFlowOrchestrator.ts`                                         | Replay the answer when the local engine advances on the server-step climb                                     |
| **Opener**                          | `onboardingOpeners.ts`                                           | Deterministic spoken first line                                                                               |

The keep-alive property is the big win: once **every** beat is in `CHAT_VAPI_BEAT_SCREENS`, `vapiShouldBeLive` never flips false between beats → **one Vapi session from mic-grant to the end**, beat transitions driven by `pushScreenContext` (no cold-start, no shutdown).

---

## 2. Per-beat readiness matrix (verified)

Legend: ✅ ready · ⚠️ gap · — n/a

| Beat               | screen_id               | step    | tool                       | handler+dispatch | precondition                | ctx block + fwd-ptr       | adapter + voice-fill             | serverCapture | opener         |
| ------------------ | ----------------------- | ------- | -------------------------- | ---------------- | --------------------------- | ------------------------- | -------------------------------- | ------------- | -------------- |
| Profile            | `ONBOARD-01--FORM`      | 1       | submit_profile             | ✅               | nickname ✅                 | ✅ (no ptr; tool-advance) | ✅                               | ✅            | ✅             |
| Fork               | `ONBOARD-FORK--FORM`    | 2       | submit_path_choice         | ✅               | path ✅                     | ✅                        | ✅                               | ✅            | ✅             |
| Category           | `ONBOARD-BEGINNER-01`   | 3       | submit_category            | ✅               | category ✅                 | ✅                        | ✅                               | ✅            | ✅             |
| Goals              | `ONBOARD-BEGINNER-02`   | 4       | submit_goals               | ✅               | goals ✅                    | ✅                        | ✅                               | ✅            | ✅             |
| Habits             | `ONBOARD-BEGINNER-03`   | 5       | add/remove_habit           | ✅               | habitConfigs ✅             | ✅                        | ✅                               | ✅            | ✅             |
| Habit schedule     | `ONBOARD-BEGINNER-04`   | 5 (sub) | add/update_habit           | ✅               | habitConfigs ✅             | ✅                        | ✅                               | ✅            | ✅             |
| Plan review        | `ONBOARD-BEGINNER-06`   | 6/7     | confirm_plan, update_habit | ✅               | finalize (`checkPlanReady`) | ✅                        | ✅ (display, no fill)            | persist-null  | ✅             |
| Reflection         | `ONBOARD-BEGINNER-07`   | 6/8     | submit_reflection_config   | ✅               | reflectionConfig ✅         | ✅                        | ✅                               | ✅            | ✅             |
| Morning setup      | `ONBOARD-MORNING-SETUP` | 7       | submit_morning_checkin     | ✅               | ⚠️ **no case**              | ⚠️ **not in bundle**      | ✅                               | ✅            | ⚠️ **missing** |
| Complete           | `ONBOARD-COMPLETE`      | end     | confirm_plan               | ✅               | — (terminal)                | ⚠️ **not in bundle**      | ✅                               | persist-null  | ⚠️ **missing** |
| **Advanced lane**  |                         |         |                            |                  |                             |                           |                                  |               |                |
| Brain dump         | `ONBOARD-ADVANCED`      | 3       | submit_brain_dump          | ✅               | brainDump ✅                | ✅                        | ⚠️ **no voice-fill** (text-only) | ✅            | ✅             |
| Adv habits         | `ONBOARD-ADVANCED-02`   | 4       | add/update/remove_habit    | ✅               | habitConfigs ✅             | ✅                        | ✅                               | (verify)      | ✅             |
| Adv reflection     | `ONBOARD-ADVANCED-04`   | 5       | submit_reflection_config   | ✅               | ⚠️ no case                  | ✅                        | ✅                               | (verify)      | ✅             |
| Adv custom prompts | `ONBOARD-ADV-CUSTOM`    | 6       | submit_custom_prompts      | ✅               | (verify)                    | ✅                        | ✅                               | (verify)      | ✅             |
| Adv plan review    | `ONBOARD-ADVANCED-05`   | 7       | confirm_plan               | ✅               | finalize                    | ✅                        | ✅                               | persist-null  | ✅             |

**Headline:** the **beginner lane (category → reflection) is essentially ready** — arming is mostly "add to the set + verify each beat live." The real net-new work is **Morning setup + Complete** (context blocks, openers, morning precondition) and the **step-model reconciliation**.

---

## 3. Gaps to close (the actual work)

### G1 — Morning setup not arm-ready

- Add `ONBOARD-MORNING-SETUP` context block to `src/generated/screen_contexts.json` **with a forward pointer** to `ONBOARD-COMPLETE` (and seed Supabase `screen_contexts` for the Direct-LLM/backend read).
- Add an opener in `onboardingOpeners.ts`.
- Add a `checkAdvanceData` case for the morning step so `navigate_next` is gated on `morningCheckin`.

### G2 — Complete not arm-ready

- Add `ONBOARD-COMPLETE` context block (terminal — `confirm_plan`, no forward pointer needed) + opener.
- Confirm `SCREEN_TO_STEP` / terminal handling maps it cleanly.

### G3 — Step-model reconciliation (HIGHEST RISK — touches live users)

- Current model is inconsistent: `beatForStep` collapses plan-review to step 7; flow `persist.step` has plan-review undefined→6 via `ENGINE_PERSISTLESS_STEP`, morning=7, reflection=8. `checkAdvanceData` only defines cases 1–6.
- Reconcile against `docs/step-0-canonical-step-table.md` (canonical climb 1→…→10). This is the one change that can move existing users mid-flow, so gate it behind the STEP-0 instrumentation already in place (`ONBOARDING_STEP_TRACE=1`) and verify with a full traced run before/after.

### G4 — Advanced brain-dump has no voice-fill reflection

- `ONBOARD-ADVANCED` adapter is a text-only textarea; on the Vapi path the brain dump is captured server-side via `submit_brain_dump` and replayed via `serverCaptureForBeat`, but the card won't show the transcribed text live. Decide: (a) accept (advances on server-step), or (b) add a voice-fill listener to mirror the transcript into the textarea.

### G5 — Minor

- `ask_clarification` exists for Direct-LLM but not Vapi dispatch (`api/_lib/vapi/dispatch.ts`) — add if we want the coach to disambiguate without a premature tool call.
- `navigate_next` ABSOLUTE-LAW tool list in `tools.onboarding.ts` — audit completeness.

---

## 4. Sequenced execution

**Phase A — Beginner lane (low risk, high value).** Arm category → goals → habits → habit-schedule → plan-review → reflection by widening `CHAT_VAPI_BEAT_SCREENS`, **one beat at a time**, testing each live (opener spoken, field fills via realtime, tool writes, `navigate_next` advances, Vapi stays live across the transition). The fork fix unblocks this whole lane.

**Phase B — Gap beats.** Land G1 (morning) + G2 (complete): context blocks + openers + morning precondition. Then arm them.

**Phase C — Step model (G3).** Reconcile the canonical step table with `checkAdvanceData` + `beatForStep` + `persist.step`, STEP-0-traced, verified end-to-end. Do this as its own isolated change.

**Phase D — Advanced lane.** Arm `ONBOARD-ADVANCED` + `-02/-04/-05/ADV-CUSTOM`; decide G4; add the missing advanced preconditions.

**Phase E — Keep-alive hardening + verification.** With all beats armed, confirm one continuous session start→finish (watch `[vapi-gate]` stays `live=true (all clear)` the whole way; confirm Vapi call `endedReason` is `customer-ended-call` only at the real end, no `did-not-receive-customer-audio` churn). Add an integration-style test asserting `CHAT_VAPI_BEAT_SCREENS` covers every voice beat in the flow.

---

## 5. Risks / watch-items

- **Step model (G3)** is the only change that can disrupt in-flight users — isolate + trace it.
- **Bundle vs Supabase divergence** — the bundle (Vapi, latency path) and Supabase `screen_contexts` (Direct-LLM/backend) are seeded separately; add both for new context blocks or the two paths diverge (CLAUDE.md "Screen context — bundled, not fetched").
- **Forward pointers** must exist on every armed non-terminal beat or `navigate_next` won't be driven by the coach.
- **Idle timeout** is a dev override now; before launch decide the real onboarding value (8s is too short; cost vs UX).
- **`update_habit`/per-habit edits** on the habits beat — confirm realtime reflects multi-write habit edits (dedup via `vapi_tool_calls`).

---

## 6. Definition of done

One Vapi session from mic-grant through `ONBOARD-COMPLETE`: every beat's opener is spoken, every answer fills the card via realtime, every tool persists, `navigate_next` advances each step, the gate logs `live=true (all clear)` continuously, and no `did-not-receive-customer-audio` calls appear in the Vapi call log for a clean run.
