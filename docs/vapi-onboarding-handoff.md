# Vapi Onboarding Integration — Handoff

**Branch:** `onboarding-cutover` · **Last updated:** 2026-06-29 · **Owner:** Yonas (engine/Vapi integration side)

This doc lets another agent pick up the Vapi onboarding work cold. Read it top to bottom once, then jump to "Open work" for what to do next. (Deployment/preview tooling is intentionally out of scope here — see `docs/local-testing-setup.md` to run it.)

---

## 1. Ownership & scope

- **Yonas (this work):** the **engine side** — wiring the three voice paths into the resynced onboarding engine, the orchestrator, the step model, the Vapi tool/handler integration, arming beats, the beat-context sync, conversation persistence, and the live-chat rendering.
- **Yair (NOT this work):** **beat design + content** — which beats exist, their order, the beat-context copy (the Master Sheet), the flow graph. Do **not** add/remove/reorder beats or rewrite beat copy; flag those to Yair.

The split: **coach content lives in the Sheet (Yair); the step model + orchestrator + Vapi plumbing + persistence is the integration (us).** `allowedTools` is **code-owned**, never in the Sheet/DB.

---

## 2. Current state (what works today)

Vapi drives **one continuous full-duplex voice session across the WHOLE onboarding flow** (no longer just profile→habits): it speaks the opener, listens, saves each beat via tool calls, advances, and accumulates prior-beat state. Coverage is now every onboarding beat.

**Armed beats** (`src/lib/onboarding/onboardingStepBeats.ts` → `CHAT_VAPI_BEAT_SCREENS`):

```
ONBOARD-01--FORM · ONBOARD-FORK--FORM · ONBOARD-BEGINNER-01 · -02 · -03 · -04 ·
ONBOARD-ADVANCED · ONBOARD-BEGINNER-06 · ONBOARD-MORNING-SETUP · ONBOARD-BEGINNER-07 · ONBOARD-COMPLETE
```

AUTH and MIC stay silent (no coach turn). The whole flow runs as one live session instead of going text-only past habits.

**Status:** type-check clean, full test suite green (1339), production build OK. The spine (profile→habits) is live-verified; the widened tail + the new persistence/opener rendering still need a **live mic-pass** (voice can't be unit-tested).

---

## 3. Architecture (the three paths)

| Path               | When                                  | Stack                                                      | Context source                                                                     |
| ------------------ | ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **1 — Vapi**       | onboarding voice (both orbs on)       | Soniox STT + OpenAI LLM + Cartesia TTS, one WebRTC session | **unified beat bundle** (§4) via `getScreenContext` → `{{initial_screen_context}}` |
| **2 — Async**      | daily check-ins                       | MP3/Sonic prompt → Soniox → callLLM → Sonic                | (check-in surface)                                                                 |
| **3 — Direct-LLM** | onboarding text / non-Vapi orb states | `/api/llm` (gpt-4o-mini)                                   | `api/_lib/llm/onboarding/beatContexts.ts` (synced; global + per-beat)              |

**Side-effect flow (Vapi):** coach calls a tool → `/api/vapi/tool` webhook → Supabase write → **Supabase Realtime** → `useOnboardingRealtimeSync` → React Query cache → orchestrator sees `current_step` climb → engine advances. Realtime is the only way the browser learns about a server-side write.

**Engine:** `/onboarding/flow` → `FlowOnboarding` → `IntroGate` → `FlowRenderer` (renders **every visited beat** as a continuous timeline) → `useFlowOrchestrator`. Flow graph: `src/onboarding-flow/flows/onboarding-beginner-v1.generated.json` (generated from Yair's flow builder; do not hand-edit).

---

## 4. Beat-context system + the Supabase sync (now stood up)

Two layers, sent fresh every turn:

- **`GLOBAL_ONBOARDING_CONTEXT`** — who the coach is, Path 1/2/3 behaviour, cross-beat rules.
- **per-beat context** — the one thing to collect, the verbatim opener, and (code-owned) `allowedTools`.

**Source of truth:** the Master Sheet **"Beats Context" tab**.

**The publishing pipeline is now LIVE** (previously designed-but-never-run):

```
 Master Sheet "Beats Context" tab
   │  scripts/voice-sync/sync_beats_context.py   (Sheet → Supabase; durable, replaces the old inline seed)
   ▼
 Supabase: beat_contexts + onboarding_globals   (migration 052, run on prod; 15 beats + 1 global)
   │  scripts/voice-sync/sync_beat_contexts.py   (Supabase → repo)
   ▼
 api/_lib/llm/onboarding/beatContexts.generated.json   (overlaid onto code defaults at import)
```

Regen chain on a Sheet change: `sync_beats_context.py` → `sync_beat_contexts.py` → `npm run beats:bundle`.

**Unification — ONE source feeds every path.** Vapi previously read a separate `screen_contexts.json` bundle (no global) + a dashboard prompt; the two engines drifted. Now:

- `scripts/build-beat-bundle.ts` (`npm run beats:bundle`) emits `src/generated/beat_contexts.json`: synced copy + opener + code-owned `allowedTools` + per-beat step/target.
- `src/lib/context/onboardingBeatBundle.ts` composes the **machinery** (ALLOWED/FORBIDDEN tools + `navigate_next(target_step=N)`) — generated from the **flow builder** (the order authority) — and prepends it to the clean synced copy.
- `getScreenContext` serves `ONBOARD-*` from this composed block for both Vapi cold-start and the mid-call heartbeat.

Result: **machinery follows the engine; copy follows the Sheet.** One Sheet edit reaches every path.

---

## 5. Lifetime conversation persistence (NEW — Part A)

Every turn from every path now persists to Supabase under **one anon_id-anchored onboarding thread**, and rehydrates on load — so the conversation survives refresh, next-beat, tab close, and a new device.

- **Migration 054** — `chat_messages.client_turn_key` + partial unique `(chat_session_id, client_turn_key)`. The voice path UPSERTs a turn whose merged text grows; `VoiceMessage` ids aren't UUIDs, so `client_turn_key` is the idempotency key.
- **`POST /api/chat/append`** (route in `api/chat/[...path].ts`) — advisory-locked `turn_index` (shares the Direct-LLM lock so the two writers never collide), `ON CONFLICT … DO UPDATE`, content truncation to 8000, onboarding anchor row (`chat_sessions` sentinel `screen_id='ONBOARDING'`).
- **`GET /api/chat/onboarding-thread`** — resolves the canonical thread by `anon_id` (cross-device; no 12h window) and returns flat turns with `client_turn_key` + `screen_id`.
- **Provider mirror** (`OnboardingVoiceProvider`) — fires on the last live voice/opener turn whenever its text grows (idempotent); skips hydrated UUID rows + Direct-LLM/error turns via `VoiceMessage.source`.
- **Hydration** — provider resolves by `anon_id`, adopts the session id, seeds the feed (server = source of truth; localStorage `onboardingThreadStore` = instant cache), pre-seeds the mirror dedup. `normalizeOpenerIds` aligns hydrated openers to the stable id.

Design notes: `docs/onboarding-persistence-and-finalization-plan.md`. Retention: onboarding `chat_messages` is kept (no auto-prune) and stored unscrubbed (gotcha #8) — deliberate.

---

## 6. Live-chat rendering (NEW — Part B + fixes)

`src/onboarding-flow/renderer/BeatPlayer.tsx` `BeatConversation` + `BeatView.tsx`:

- **Opener from the transcript**, not pre-rendered authored text. Cold-start Cartesia opener is appended to the message store (`source:'opener'`, stable id `opener-${sid}`) and **karaokes in sync with the real audio** — `speakOpener` reports playback progress (`currentTime/duration`) → `openerReveal` → `Karaoke revealCount`. Warm Vapi openers stream word-by-word as STT partials.
- **No duplicate opener on re-entry/refresh.** The opener (first pre-user coach turn) gets the stable per-beat id `opener-${sid}` on cold AND warm paths, so a re-spoken opener **replaces** the bubble in place instead of stacking.
- **Whole conversation stays on screen.** Every beat renders its full conversation from the store, so a completed beat keeps its turns and rehydrates after refresh (no collapse to a receipt).
- **Card in the timeline.** `opener → card → dialogue` (the beat component sits right after the opener).
- **One bubble per turn.** The live partial extends the current turn's single bubble when it continues that turn; a new-turn partial renders as its own single bubble. Fixes the "splits to two then collapses to one" glitch.
- Past data beats also keep a **frozen receipt card** below their dialogue.

---

## 7. The step model (integration-owned)

`navigate_next` (`api/_lib/vapi/handlers/navigateNext.ts`, `MAX_STEP=10`) is the ONLY writer of `current_step`. Backend gate: `checkAdvanceData` (`api/_lib/llm/onboarding/preconditions.ts`). Frontend leading-edge advance: `useFlowOrchestrator.ts` (baseline-reset per beat). Machinery `target_step` is now **derived from the flow builder** by `build-beat-bundle.ts` (effective step = `persist.step ?? ENGINE_PERSISTLESS_STEP[screenId]`; habits 03/04 are one step → both target plan-review). Locked by `src/lib/context/onboardingBeatBundle.test.ts`.

Diagnostic: `ONBOARDING_STEP_TRACE=1` → backend `[step0] …`; frontend `[vapi-gate] live=… blockers: …`.

---

## 8. Open work (prioritized)

### OURS (integration)

1. **Live mic-pass validation** (the main remaining item; voice can't be unit-tested): every beat engages live (beginner + advanced); opener karaoke in sync, no double-speak; one bubble per turn; turn order; habit 03→04 stays live (no teardown); refresh + new-tab restore from the server thread; idle teardown holds so calls don't burn credits.
2. **`BEGINNER-06` order copy vs machinery** — the synced copy reads as the final plan review while the machinery follows the flow builder (→ morning-setup). Nav is correct; the coach line is slightly ahead until the order change lands.
3. **Soniox turn-merge artifact** — one utterance occasionally splits into two `chat_messages` rows (e.g. profile beat). Tighten the final-merge in `handleTranscript`.

### SHARED / YAIR

4. **Vapi global unification (dashboard side).** The Vapi assistant's persona/global still lives in the dashboard (a separate copy from the synced `onboarding_globals`), and `{{initial_screen_context}}` appears twice in the assistant prompt. Folding the synced global in + de-duping the slot kills the last drift — touches the shared Coach Yair assistant config, so needs Yair's OK.
5. **Beat-context source-of-truth going forward** — Sheet-authored (the sync makes the Sheet canonical) vs. code-authored with the sync as a publish step. Confirm with Yair.
6. **AUTH name capture** — design says the name comes from sign-in; confirm the profile beat no longer needs to ask.

---

## 9. How to run / test locally

Full agent runbook: **`docs/local-testing-setup.md`** (env, ngrok, Vapi sync, the two servers, verify checks). In short:

- `npm run dev:api` (vercel dev :3000) + `npm run dev` (Vite :5173); `/onboarding/flow`.
- Vapi local loop: ngrok → set `VAPI_WEBHOOK_BASE_URL` in `.env.local` → `npm run vapi:sync -- --dev` points the assistant's tool webhooks at the tunnel. Re-run after editing `tools.onboarding.ts`/`assistant.ts` or whenever ngrok's URL changes.
- Keep Vapi live while testing: `VITE_ONBOARDING_VAPI_IDLE_TIMEOUT_MS=600000`.
- QA: `/onboarding/qa` logs in `qa-onboarding-*@guidedgrowth.test`; `/api/qa/self-reset` wipes onboarding to retest.
- Diagnose a Vapi failure: fetch the call's `endedReason` from `https://api.vapi.ai/call?assistantId=$VITE_VAPI_ASSISTANT_ID` with `VAPI_PRIVATE_KEY`.

---

## 10. Key files

| What                                                              | Where                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Armed beats set                                                   | `src/lib/onboarding/onboardingStepBeats.ts` (`CHAT_VAPI_BEAT_SCREENS`)           |
| Orchestrator (state machine, leading-edge, resume)                | `src/onboarding-flow/useFlowOrchestrator.ts`                                     |
| Flow graph (generated; Yair-owned, order authority)               | `src/onboarding-flow/flows/onboarding-beginner-v1.generated.json`                |
| Vapi lifecycle/gate, opener, mirror, hydration                    | `src/contexts/OnboardingVoiceProvider.tsx`                                       |
| Live-chat renderer (opener/karaoke, one-bubble, card-in-timeline) | `src/onboarding-flow/renderer/BeatPlayer.tsx`, `BeatView.tsx`                    |
| Cartesia opener (playback progress)                               | `src/lib/voice/speakOpener.ts`                                                   |
| Conversation persistence endpoints                                | `api/chat/[...path].ts` (`append`, `onboarding-thread`)                          |
| Thread persistence (localStorage cache)                           | `src/contexts/onboardingThreadStore.ts`                                          |
| Persistence migration                                             | `supabase/migrations/054_chat_messages_client_turn_key.sql`                      |
| Sheet → Supabase sync (durable)                                   | `scripts/voice-sync/sync_beats_context.py`                                       |
| Supabase → repo sync                                              | `scripts/voice-sync/sync_beat_contexts.py`                                       |
| Beat tables migration                                             | `supabase/migrations/052_beat_contexts.sql`                                      |
| Direct-LLM beat context (synced)                                  | `api/_lib/llm/onboarding/beatContexts.ts` (+ `.generated.json`)                  |
| Frontend beat bundle generator                                    | `scripts/build-beat-bundle.ts` → `src/generated/beat_contexts.json`              |
| Vapi machinery composer                                           | `src/lib/context/onboardingBeatBundle.ts`                                        |
| Vapi tool defs + sync                                             | `api/_lib/llm/tools.onboarding.ts`, `scripts/vapi-sync/{sync,assistant,wrap}.ts` |
| Vapi handlers + dispatch                                          | `api/_lib/vapi/handlers/*`, `api/_lib/vapi/dispatch.ts`                          |
| Advance preconditions (the gate)                                  | `api/_lib/llm/onboarding/preconditions.ts`                                       |

---

## 11. One-paragraph summary

Vapi onboarding now runs as one continuous voice session across the **whole** flow, fed by a **single beat-context source** (the Sheet→Supabase→repo sync is live; machinery is flow-builder-derived) instead of two engines that drifted. On top of that, the **entire conversation persists to Supabase** under one anon_id-anchored thread (cross-device, survives refresh), the **opener renders from the transcript and karaokes in sync with the voice**, and the live chat is correct (one bubble per turn, card in the timeline, no duplicate opener, nothing disappears). It's type/test/build green; the main remaining work is a **live mic-pass** across all beats, the `BEGINNER-06` copy-vs-machinery nudge, the Soniox turn-merge artifact, and folding the Vapi dashboard global into the synced source (Yair).
