# Onboarding Flow — Review Handover

**Date:** 2026-06-25
**Branch reviewed:** `staging`
**Scope:** the `/onboarding/*` routes and everything behind them — routing/gating, per-step page logic, state machine & persistence, the "beats" context pipeline, the Vapi (Path 1) voice integration, and the backend tool-dispatch / system-prompt layer.
**Method:** two rounds, 4 parallel review agents each (8 total), every headline finding re-verified by hand against source. `tsc --noEmit` clean, all 1227 unit tests pass.

> **TL;DR for triage:** the linear _tap_ flow ships and is solid. The real problems are in **resume / interruption paths** and in **three context stores that were never reconciled** (router ↔ bundle JSON ↔ Supabase). One root cause recurs: `current_step` alone can't tell the beginner fork from the advanced fork. Five issues are user-blocking or cost-relevant — see **Priority Fix List**.

---

## How the flow is wired (shared vocabulary)

```
voice-preference → mic-permission → step-1 → step-2 (FORK)
                                                  │
                 ┌── simple ─────────────────────┤
                 │                                └── braindump ──┐
   step-3 → step-4 → step-5 → step-6                 advanced-input → advanced-results
                       (→ step-6-prompts)                → advanced-step-6 (→ advanced-custom-prompts)
                 └──────────────► step-7 (Plan Review) ◄──────────┘
```

- **`current_step`** (1–10) is persisted in Supabase `onboarding_states`, anon_id-scoped, monotonic via `GREATEST`. `OnboardingEntry` resumes a user to `/onboarding/step-${current_step}`.
- **Two voice/chat paths drive the same screens:**
  - **Path 1 (Vapi)** — bundled STT+LLM+TTS. Reads the **build-time bundle** `src/generated/screen_contexts.json`. _Keeps_ forward pointers (`NEXT: -> SCREEN`) to drive navigation.
  - **Path 3 (Direct-LLM / text chat)** — `/api/llm`. Reads the **Supabase `screen_contexts` table** (`api/_lib/llm/buildSystemPrompt.ts:64`). _Strips_ forward pointers, rewrites `navigate_next`→`advance_step`, appends no-prenarration rule.
- **"Beats"** = the narrative `context_block` text per screen, authored in a Google "beats" Sheet and applied by `scripts/onboarding-beats/apply_beats.py` — **which writes the bundle JSON only.**

---

## Priority Fix List (start here)

| P   | Issue                                                                                         | Severity    | Effort | Where                                                                |
| --- | --------------------------------------------------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------- |
| 1   | Step-8 redirect loop after voice plan-confirm (white screen, no escape)                       | 🔴 Critical | S      | `src/routes/index.tsx:118`                                           |
| 2   | Advanced/braindump users resume into the **wrong (beginner) fork**; work appears lost         | 🔴 Critical | S–M    | `src/routes/index.tsx:119`                                           |
| 3   | Beats pipeline updates the bundle only → Vapi & text-chat coaches diverge per beat            | 🔴 High     | M      | `scripts/onboarding-beats/apply_beats.py`, `buildSystemPrompt.ts:64` |
| 4   | Habit reminder **time silently lost** in advanced branch (edit dropped; then hardcoded 21:45) | 🔴 High     | S      | `AdvancedStep6Page.tsx:116`, `AdvancedResultsPage.tsx:23`            |
| 5   | Dead forward pointers → Vapi navigated to **nonexistent screens**                             | 🔴 High     | S      | `screen_contexts.json` (FORK, MIC-PERMISSION, ADVANCED-02)           |
| 6   | `PUT … RETURNING` omits `updated_at`/`created_at` → defeats Realtime stale-guard              | 🟠 High     | XS     | `api/onboarding/[...path].ts:44`                                     |
| 7   | Vapi idle auto-pause is inert — mic stays hot indefinitely (cost)                             | 🟠 High     | S      | `OnboardingVoiceProvider.tsx:908`                                    |
| 8   | `onEnd` double-fires on every stop → spurious 3s cooldown blocks restart                      | 🟠 High     | S      | `useRealtimeVoice.ts:277`                                            |

S = small / isolated. All are surgical and testable.

---

## Round 1 — Routing, Pages, State, Advanced + Backend

### 🔴 Critical / High

**R1-1 · Infinite redirect loop after voice plan-confirm.** `src/routes/index.tsx:118-119`
Voice "let's go" bumps `current_step` to **8** (`PlanReviewPage.tsx:137` only auto-completes when `current_step > 7`); the client then flips `status` to completed. If the app is killed or `complete()` fails in that window, the user reopens as `{in_progress, step:8}`. `OnboardingEntry` → `/onboarding/step-8` → **no such route** → app catch-all (`index.tsx:353`) → `AppGate` sees `in_progress` → `/onboarding` → back to step-8. White-screen loop, no escape.
_Fix:_ clamp — `step-${Math.min(gate.step, 7)}` — and add an `/onboarding/*` fallback route.

**R1-2 · Braindump users resume into the wrong fork; data looks lost.** `src/routes/index.tsx:119`
`OnboardingEntry` ignores `gate.path`. A braindump user at `current_step` 3/4/5 who refreshes is sent to beginner `step-3/4/5`, which then cascade-redirect on missing `category`/`goals` — dumping them into the wrong flow with their work invisible.
_Fix:_ branch on `gate.path === 'braindump'` for steps 3–5 → `advanced-input/-results/-step-6`.

**R1-3 · `PUT … RETURNING` omits `updated_at`/`created_at`.** `api/onboarding/[...path].ts:44`
`OnboardingState` types both as required `string`, but the save response writes them `undefined`. `useOnboardingRealtimeSync.ts:67`'s stale-guard (`current.updated_at > next.updated_at`) then short-circuits in exactly the post-save window it protects → a late Realtime echo of an **older** row can clobber fresh state. One-line root cause behind two separate High findings.
_Fix:_ add `updated_at, created_at` to the RETURNING clause.

**R1-4 · Habit reminder times lost in the advanced branch.** `AdvancedStep6Page.tsx:116,121` + `AdvancedResultsPage.tsx:23-27`
Two data-loss bugs: (a) `EditHabitPage` sends an edited `time`, but `applyLocationState` only spreads `{name, days}` — the edit is dropped. (b) `AdvancedStep6` then **hardcodes `time: '21:45'`** for every habit, overwriting what AdvancedResults persisted. "Meditate at 7am" ends up reminding at 9:45 PM.
_Fix:_ thread `time` through `UpdatedHabit`/`applyLocationState`; use `h.time ?? '21:45'` in AdvancedStep6.

### 🟡 Medium

- **Step6Page silent stuck CTA** — `Step6Page.tsx` lacks the render guard step-4/5 have. Missing `habitConfigs` → tap Continue → spinner flashes, nothing happens, no error. Add a `<Navigate to="step-5">` guard.
- **PlanReview missing-state fallback is beginner-only** — `PlanReviewPage.tsx:196` sends advanced users to beginner `step-5/6`. Branch on `source`.
- **`EditJournalPage` is dead code** — registered at `routes/index.tsx:289` but nothing navigates to it; its outputs have no consumers. Wire it or remove.
- **Provider timer leaks** — `OnboardingVoiceProvider.tsx:628` unmount cleanup misses `formSnapshotPushTimer`/`mergeWindowTimer`/`idleTimer`. Low impact (provider rarely unmounts); fires `client.send` post-teardown under StrictMode/HMR.

### 🟢 Low

No `/onboarding/*` catch-all (feeds R1-1); `VoicePreferencePage`/`MicPermissionPage` buttons lock permanently if the save throws (no try/finally); `handleCreatePrompts` lacks a re-entry guard; analytics `step_number` is offset from route numbers; advanced empty-state "Looks Good!" copy is misleading.

### ✅ Verified working (Round 1)

Happy-path tap flow (every route resolves, validation gates present, data persisted before nav); agent/voice leading-edge auto-advance is sound and idempotent (`advancedRef` + `arrivedAheadRef`, unit-tested); completion→app transition race is correctly fixed; LLM braindump-parse failure falls back to regex (no stuck-on-results); backend fully anon_id-scoped & parameterized (no SQLi, monotonic step clamp, `complete` is a transaction); Realtime teardown, cross-user thread wipe, and bubble dedup all correct.

---

## Round 2 — Beats, Vapi, Cross-Layer Consistency

### 🔴 High

**R2-1 · Beats only update the bundle → Vapi and text-chat diverge.** _(verified)_ `apply_beats.py` + `buildSystemPrompt.ts:64`
The pipeline rewrites `context_block`s in `src/generated/screen_contexts.json` (Vapi/frontend) but does **not** seed Supabase `screen_contexts` (Direct-LLM). Every applied beat makes the two coaches read different instructions for the same screen. `ONBOARD-01--FORM` already diverges — Vapi sees the new short profile beat; text chat still runs the old long block.
_Fix:_ have the beats pipeline also write Supabase (`scripts/voice-sync/seed_contexts.py`), or point Path-3 at the bundle.

**R2-2 · Dead forward pointers send Vapi to nonexistent screens.** _(verified)_ `screen_contexts.json`
`ONBOARD-FORK--FORM` references `ONBOARD-ADVANCED-01` three times, but the real bundle key is `ONBOARD-ADVANCED`. Vapi keeps forward pointers → on the advanced fork it's pointed at a missing screen → null context → generic fallback, losing the advanced script. Same class: `MIC-PERMISSION → POST-AUTH-01 [DEPRECATED]`, and `ADVANCED-02 → ONBOARD-BEGINNER-07` (a reflection screen the advanced React flow never mounts).
_Fix:_ correct these pointers in the bundle (and Supabase, per R2-1).

**R2-3 · Vapi idle auto-pause is dead code — mic stays hot indefinitely.** `OnboardingVoiceProvider.tsx:908-928`
After 8s of silence the idle timer calls `systemPauseMic()`, which only sets a transient flag that **only the Soniox STT path reads**. `vapiShouldBeLive` never consults it, so the Vapi call (mic + WebRTC) stays fully live forever. Intended auto-pause never happens — relevant to voice-minute cost and the cap accounting it backs.

**R2-4 · `onEnd` double-fires on every stop → spurious 3s cooldown blocks restart.** `useRealtimeVoice.ts:277-283` + VoiceContext `releaseToken`
`stop()` runs `cleanup()` (resets `tearingDownRef=false`) → `dropToken()` → `releaseToken()` synchronously re-invokes the token's `onEnd`, then `stop()` calls `onEnd` again. The second call looks like a _remote_ end → arms a 3s `remoteEndCooldown` that suppresses restart. Toggling voice off then on is blocked ~3s.

### 🟡 Medium / Low

- **Advanced-path resume lands on beginner pages** — same root as R1-2, reconfirmed via step-number collisions (advanced & beginner both use steps 3/4/5; `OnboardingEntry` disambiguates by step only).
- **Stale `ROUTE:` headers** inside many context_blocks (`/onboard/02`, `/onboard/advanced/01`) — cosmetic, but prove the bundle text was never reconciled with the router.
- **`step-6-prompts` (`ONBOARD-BEGINNER-08`) has no opener** in `onboardingOpeners.ts` → empty first bubble on the chat path.
- **`apply_beats.py` `split_header()`** assumes every block has a blank-line header; no guard — a future header-less beat would corrupt the body. Safe today (all 32 blocks have a blank line).
- **edit-habit / edit-journal register no screenId** → coach uses stale/empty context there.
- **Backend consistency (all Low):** `submit_profile` required-fields differ between Vapi (`[]`) and Direct-LLM (`['nickname']`); the profile-screen prompt says "need all 4 to advance" but the precondition only requires nickname; `confirmPlan` checks a dead `advancedHabitConfigs` key nothing writes; `getNumberArray` rejects stringified ints LLMs commonly emit.

### ✅ Verified working (Round 2)

Beat **coverage is complete** — every registered onboarding screenId has a bundle `context_block`; nothing silently falls back to `/api/context`. The **prior tool cross-wiring bug is genuinely fixed** — dispatch routes screen-first, so `update_habit` (in both onboarding and check-in sets) hits the right handler; `allowedToolNames` blocks off-screen tools. Backend handlers all anon_id-scoped with correct advance_step MIN/MAX/skip guards and an advisory-lock-atomic `add_habit`. Profile value injection (nickname/age) works via `buildContextMessage`'s form-state block. Orb state machine + `routeOrbSend` are pure/total/exhaustively tested; forward-pointer strip policy (Path-3 strips, Vapi keeps) is correct; Vapi single-instance reuse + teardown-race guards are sound.

---

## Cross-layer reference: master consistency table

Step = `useAgentNavigation(N)`. "Bundle route ✓" = the entry's `route` field matches the real router path.

| Route                               | Registered screenId  | In bundle | Bundle route ✓ | Step | Paths | Forward pointer → target      | Valid?                   |
| ----------------------------------- | -------------------- | --------- | -------------- | ---- | ----- | ----------------------------- | ------------------------ |
| /onboarding/voice-preference        | VOICE-PREFERENCE     | ✅        | ✅             | —    | tap   | —                             | n/a                      |
| /onboarding/mic-permission          | MIC-PERMISSION       | ✅        | ✅             | —    | tap   | POST-AUTH-01 [DEPRECATED]     | ❌                       |
| /onboarding/step-1                  | ONBOARD-01--FORM     | ✅        | ✅             | 1    | 1+3   | —                             | n/a                      |
| /onboarding/step-2                  | ONBOARD-FORK--FORM   | ✅        | ✅             | 2    | 1+3   | BEGINNER-01 / **ADVANCED-01** | ❌ (ADVANCED-01 missing) |
| /onboarding/step-3                  | ONBOARD-BEGINNER-01  | ✅        | ✅             | 3    | 1+3   | BEGINNER-02                   | ✅                       |
| /onboarding/step-4                  | ONBOARD-BEGINNER-02  | ✅        | ✅             | 4    | 1+3   | BEGINNER-03                   | ✅                       |
| /onboarding/step-5                  | ONBOARD-BEGINNER-03  | ✅        | ✅             | 5    | 1+3   | target_step=6                 | ✅                       |
| /onboarding/step-6                  | ONBOARD-BEGINNER-07  | ✅        | ✅             | 6    | 1+3   | target_step=7                 | ✅                       |
| /onboarding/step-6-prompts          | ONBOARD-BEGINNER-08  | ✅        | ✅             | 6    | 1+3   | target_step=7                 | ✅ (no opener)           |
| /onboarding/step-7 (beginner)       | ONBOARD-BEGINNER-06  | ✅        | ✅             | —    | 1+3   | confirm_plan → home           | ✅                       |
| /onboarding/step-7 (advanced)       | ONBOARD-ADVANCED-05  | ✅        | route:null     | —    | 1+3   | HOME-DEFAULT                  | ✅                       |
| /onboarding/advanced-input          | ONBOARD-ADVANCED     | ✅        | ✅             | 3    | 1+3   | ADVANCED-02                   | ✅                       |
| /onboarding/advanced-results        | ONBOARD-ADVANCED-02  | ✅        | ✅             | 4    | 1+3   | **BEGINNER-07**               | ⚠️ wrong screen          |
| /onboarding/advanced-step-6         | ONBOARD-ADVANCED-04  | ✅        | route:null     | 5    | 1+3   | ADVANCED-05                   | ✅                       |
| /onboarding/advanced-custom-prompts | ONBOARD-ADV-CUSTOM   | ✅        | route:null     | 5    | 1+3   | ADVANCED-05                   | ✅                       |
| /onboarding/edit-habit              | _(none)_             | —         | —              | —    | 1     | —                             | n/a                      |
| /onboarding/edit-journal            | _(none, dead route)_ | —         | —              | —    | —     | —                             | n/a                      |

Bundle-only keys with no page (`route: null`): `BEGINNER-04`/`-05` (legit habit-sheet sub-screens, pushed via `pushSubScreen`), `BEGINNER-09`, `ADVANCED-03` (dead/aspirational).

---

## Suggested fix grouping (each isolated + testable)

- **Group A — Routing resilience:** step-8 clamp + fork-aware resume (consult `gate.path`) + `/onboarding/*` fallback route. _(R1-1, R1-2, R2 resume)_
- **Group B — Beats / pointers:** fix the 3 dead forward pointers; make `apply_beats.py` also seed Supabase `screen_contexts`; add a `split_header` guard; add the `BEGINNER-08` opener. _(R2-1, R2-2)_
- **Group C — Vapi lifecycle:** wire idle auto-pause to actually stop/pause Vapi; latch `onEnd` so it fires once per teardown. _(R2-3, R2-4)_
- **Group D — Data integrity:** RETURNING `updated_at/created_at`; thread habit `time` through the advanced edit/step-6 path; Step6Page render guard. _(R1-3, R1-4, R1 Step6)_

---

## Notes for the spec / product side (Yair)

- The **`route` / `ROUTE:` / `NEXT:` fields in `screen_contexts.json` are out of sync with the actual router** across most screens. They're authored in the beats Sheet. Worth a pass to reconcile screenIds (`ONBOARD-ADVANCED-01` vs `ONBOARD-ADVANCED`) and routes so the Sheet, bundle, and router agree.
- The **advanced (braindump) reflection screen** is `ONBOARD-ADVANCED-04`, but the FORK/ADVANCED beats point at the _beginner_ reflection screen `ONBOARD-BEGINNER-07`. Confirm the intended advanced reflection screen so the pointers can be fixed correctly.
- Decide the **single source of truth for onboarding coach copy**: today the beats pipeline edits the bundle (Vapi) only; text chat reads Supabase. They will keep diverging until one feeds the other.
