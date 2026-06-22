# Master Plan — Smoother Home-Coach Turn-Taking

> Status: **planning** (no code written yet). Committed scope: **Phase 0 + Phase 1**, heuristic
> detector, internal constant (no user preference yet). Phases 2–3 documented as future reference.
> Owner: Yonas (check-ins, Path 2/3).

---

## 1. Problem & core insight

The home coach (`HOME-CHECKIN` / `MCHECK-01` / `ECHECK-01`) runs a **half-duplex async voice loop**:
Soniox STT (WebSocket) → buffer/aggregate → LLM (`/api/llm` via `useLLM`) → Cartesia TTS.

Two felt problems:

1. **It cuts people off.** End-of-turn is decided by a blind fixed timer; anyone who pauses
   mid-thought (lists, "because…", hesitations) gets submitted early.
2. **It doesn't feel realtime.** Barge-in exists in code but can't fire during playback because
   the mic is muted while the coach speaks.

**Insight:** the fix is not a single bigger timer. It's (a) replacing "wait a fixed N ms of silence"
with "wait until the user _sounds_ done," in the right layer, and (b) treating true full-duplex as a
separate, higher-risk effort gated on iOS echo cancellation.

---

## 2. Ground truth — how turn-taking works today

A single user turn passes through **three** stacked silence/endpoint mechanisms, in order:

| #   | Mechanism                                               | Where                        | Value                         | Role                                                                                                           |
| --- | ------------------------------------------------------- | ---------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Soniox server endpointing (`enable_endpoint_detection`) | `soniox-stream.ts:259`       | Soniox heuristic              | Emits `<end>` → flushes a **final** → socket back to `listening` (`:197`). Triggers `handleSonioxFinal`.       |
| 2   | **App aggregation debounce**                            | `useCoachChat.ts:42,239,254` | `TURN_AGGREGATION_MS = 1000`  | Buffers finals; **re-armed by every non-empty interim** (`:252-255`). The de-facto "think pause." Flush → LLM. |
| 3   | Client VAD socket-close                                 | `soniox-stream.ts:494`       | `VAD_SILENCE_CLOSE_MS = 2500` | Closes the _paid_ socket after 2.5s silence (fallback finalize + cost control).                                |

Plus `MIC_GRACE_MS = 2500` (`useCoachChat.ts:38,275-286`) mutes the mic for 2.5s **after** TTS.

**Felt end-of-turn latency ≈ Soniox `<end>` + 1000ms aggregation + LLM TTFB + Cartesia TTFB.**
Mechanism #2 is the only piece we fully control, and it is blind.

### Turn lifecycle (file/line map)

`handleSonioxFinal` (`useCoachChat.ts:227-242`) → `setInterim('')` → broadcast final →
`interruptTts()` (`:210-213` → `stopTTS()` + `endCoachSpeechTurn()`) → append to `utteranceBufferRef`
(`:235-237`) → arm `aggregationTimerRef = setTimeout(flushUtterance, TURN_AGGREGATION_MS)` (`:238-239`).
Interims (`:244-258`) re-arm the timer only when `t.trim()` is non-empty (`:252-255`).
`flushUtterance` (`:216-225`) trims the buffer and calls `submitTurnRef.current(text)`.
`submitTurn` (`:492-508`): if `!chatSessionId || isStreaming` → queue into `pendingTurnRef`
(space-joined, `:498-503`), else `sendMessage`. Pending flush effect at `:511-516`.
LLM stream in `useLLM.ts` (`runStream` `:138`, `AbortController` `:158-159`, `done` `:212-247`).
Stream-chunked TTS effect `useCoachChat.ts:411-433`; final-message effect `:438-467`.

### Barge-in today

Wired (`interruptTts()` `:210-213`, fired from `:234` and `:250`) **but cannot fire during playback**:
the mic is muted via `responding` which drops frames (`soniox-stream.ts:292`, `:681`). It only works in
the post-TTS grace window.

### Latent bug (fix early)

`interruptTts()` calls `stopTTS()` but **never aborts the in-flight LLM stream** (`useLLM.cancel()` is
not called). The coach keeps computing a now-stale reply that lands via `pendingTurnRef`. Hurts
perceived smoothness. Fix in Phase 0/1.

---

## 3. Strategy — 4 phases

```
Phase 0  Internal configurable pause + instrumentation + LLM-abort fix   ship now,  ~0 risk   [COMMITTED]
Phase 1  Heuristic semantic endpointing (transcript, pure reducer)       ~1 PR,     low risk  [COMMITTED]
Phase 2  smart-turn audio model + @ricky0123/vad-web                      bigger,    medium    [FUTURE]
Phase 3  True full-duplex barge-in (AEC)                                  spike,     high      [FUTURE / GATED]
```

Front-loaded on purpose: Phases 0–1 need **no new dependencies and carry near-zero iOS risk**, yet
remove the bulk of real cutoffs. Decide on models only after reading Phase 0 metrics.

### Sequencing (important — for attribution)

Ship **Phase 0 alone first**, let the new metrics bake a few days, **then** ship Phase 1. Shipping
them together makes the improvement unattributable — you couldn't tell whether a smoother feel came
from the longer base pause (Phase 0) or the adaptive heuristic (Phase 1). Order: instrument → measure
the simple fix → add the smart fix → compare against the same metrics.

---

## 4. Phase 0 — Internal configurable pause + instrumentation _(COMMITTED)_

**Goal:** give "room to think" now, make the pause a single internal constant (no preference plumbing
yet), fix the LLM-abort bug, and add the metrics that prove whether later phases help.

### Changes

1. **Lift the pause to config.** Move the default out of the `const TURN_AGGREGATION_MS` at
   `useCoachChat.ts:42` into `src/config/voiceConfig.ts` (the established home for numeric voice
   config). Default **1800–2000ms**. Keep it a plain internal constant for now.
2. **Keep the ordering invariant.** Ensure `VAD_SILENCE_CLOSE_MS` (`soniox-stream.ts:494`) stays
   **> max aggregation window** so the paid socket stays alive long enough for a late resume to merge
   into the _same_ utterance instead of spawning a second turn. If pause goes to ~2s, bump
   `VAD_SILENCE_CLOSE_MS` to ~3000–3500 (small added STT cost — note the tradeoff). Fix the stale
   `MIC_GRACE_MS` comment that claims it "mirrors `VAD_SILENCE_CLOSE_MS`" (they are independent).
3. **Abort the LLM on barge-in.** When a new user turn starts while `isStreaming`, call the `useLLM`
   abort path (it already owns an `AbortController`, `useLLM.ts:158-159`) instead of letting the stale
   reply complete and land via `pendingTurnRef`.

### Instrumentation (makes everything after measurable — there are ZERO turn metrics today)

Add via `track()` (`src/analytics/posthog.ts:69-85`, auto-attaches `input_method`):

- `coach_turn_completed` at `flushUtterance` (`useCoachChat.ts:216`):
  `{ pause_ms, ms_since_last_final, num_finals_merged, decided_by: 'timeout' | 'semantic' }`.
- `coach_barge_in` at `interruptTts` (`:210`): `{ during_playback, ms_into_tts }` (false-cutoff proxy).
- `coach_turn_resumed` when an interim re-arms the timer after a final landed — directly measures
  "we almost cut them off."

These three give before/after cutoff-rate and latency for every later phase.

### Deferred from Phase 0 (per decision: internal constant first)

User-facing **preference** plumbing is NOT done now. When/if wanted, it's 4 edits mirroring
`recordingMode`: `packages/shared/src/types/index.ts:148-164` (snake_case) →
`src/lib/preferences/snapshot.ts:10-38` (type + `DEFAULT_PREFERENCES`) →
`src/hooks/useUserPreferences.ts:28-41` (`CAMEL_TO_SNAKE`) → new Supabase migration column.
Do **not** use `voiceSettingsStore` (runtime-transient only).

---

## 5. Phase 1 — Heuristic semantic endpointing _(COMMITTED)_

**Goal:** replace the blind timer with an _adaptive_ one — flush fast when the user clearly finished,
extend the window when they clearly didn't. Highest-leverage, lowest-risk change. No deps, no model,
no iOS risk.

### Design — pure reducer (mirrors the codebase's tested seam)

`soniox-stream.ts` already exposes pure reducers (`updateVad`, `shouldOpenSocket`, `shouldCloseSocket`)
tested in node env with injected `now`/timers (`__tests__/soniox-stream.test.ts`). Mirror that:

```ts
// new: src/lib/voice/turnDecision.ts  (pure, unit-tested in node env)
export type TurnVerdict = 'complete' | 'incomplete' | 'unsure';
export function isSemanticEndOfTurn(text: string): TurnVerdict;
export function shouldFlushTurn(state, now, basePauseMs): boolean;
```

Heuristic signals (transcript-only, instant, zero cost):

- **complete** → terminal punctuation; complete clause; question-word + verb → flush at a _short_
  window (~600–900ms).
- **incomplete** → trailing conjunction/filler ("and", "but", "so", "because", "I…", "um", "like");
  no terminal punctuation + very short → extend up to a hard-capped _long_ window (≈ configured max).
- **unsure** → use the Phase 0 default.

### Insertion point (single clean gate)

`flushUtterance()` (`useCoachChat.ts:216-225`) already owns the accumulated transcript
(`utteranceBufferRef`). On timer fire: run `isSemanticEndOfTurn(buffer)` → flush, or re-arm a **bounded**
extension timer. **Soniox's own endpointing (mechanism #1) stays ON** — we gate the _flush_, not the
_finals_, so no conflict.

### Why heuristic before a model

Pure function: zero bundle, zero network, zero iOS risk, fully unit-testable with the existing
`vi.useFakeTimers()` pattern (`useCoachChat.aggregation.test.tsx`). Captures the bulk of real cutoffs
(trailing "and…", "because…", list-reading). Ship it, read Phase 0 metrics, escalate only if the data
says the heuristic misses.

---

## 6. Phase 2 — Model-grade detection _(FUTURE — only if Phase 1 metrics demand)_

Two independent upgrades.

### 6a. `smart-turn-v3.1` — semantic _audio_ end-of-turn (quality ceiling)

- BSD-2, **8.68MB int8 ONNX**, Whisper-tiny encoder + classifier, ~12ms CPU native, input **16kHz mono**
  (~8s window) — matches the capture format exactly.
- **Blocker:** the 16kHz Float32 audio is trapped in the `startSonioxBrowserSession` closure. Needs an
  **audio tap at `soniox-stream.ts:689`** (the `down` buffer — downstream of the Soniox split, so
  non-invasive) plumbed to the decision layer.
- **Runtime:** `onnxruntime-web` in a **Web Worker** (never main thread), **single-thread WASM**
  (no COOP/COEP in the Capacitor WKWebView), wasm + model assets **bundled locally** (CDN blocked
  offline). No WebGPU on iOS.
- **Fallback:** run the 8MB ONNX in a Vercel function (<100ms) — but adds a per-turn network round-trip
  (less snappy). Prefer in-browser.
- _Skip `livekit/turn-detector`_: ~140MB + ~400MB RAM (too heavy for WKWebView), non-standard license.

### 6b. `@ricky0123/vad-web` — better speech-boundary VAD

- ISC, Silero v5 (~2.2MB). Key knob **`redemptionFrames`** (silence tolerated mid-speech before ending)
  attacks premature cutoffs at the VAD layer.
- Feed it the **existing** stream via `getStream` / `AudioNodeVAD` (no second mic graph). Replaces the
  RMS/EMA block at `soniox-stream.ts:675-687`.
- **Watch-outs:** keep raw RMS for the ripple (`audioMetricsStore.pushChunkRms`, `:677`) — vad-web emits
  no per-frame RMS; reconcile its pre-speech pad with the existing 1.5s prebuffer (`:624`) so they don't
  double-count; **device-test on iOS Capacitor** (no definitive WKWebView confirmation).

---

## 7. Phase 3 — True full-duplex barge-in _(FUTURE / GATED)_

The actual "Vapi feel" — interruption _during_ playback. A spike, not a config change.

- Keep the mic hot during TTS instead of muting (`micMutedForTts`, `useCoachChat.ts:273`), running VAD
  on the **echo-cancelled** signal.
- **Blocker = AEC on iOS/Capacitor.** TTS plays through two paths the browser AEC may not have in its
  reference signal: the Web Audio `pcmPlayer` (WS karaoke) and the `<Audio>` element (HTTP fallback). If
  AEC misses them, Soniox transcribes the coach's own voice → self-interrupt loop.
- Also breaks two invariants: the hardcoded **"speaking wins"** branch (`useCoachChat.ts:326`) and the
  **single-owner voice-channel token** (`VoiceContext.tsx`) — both must yield to listening mid-playback.
- **Gate the whole phase on an AEC proof-of-concept on a real iOS device.** If AEC fails there, stop —
  keep half-duplex and lean on Phase 1/2 fast endpointing. (Vapi gets AEC free via WebRTC/Daily.)

---

## 8. Edge cases & risks (consolidated)

| Edge case                            | Status / plan                                                              |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Multiple Soniox finals in one turn   | Handled (buffer + re-arm, `:235-239`); preserve through new gate           |
| Barge-in mid-LLM-stream              | **Bug today** — LLM not aborted. Fix in Phase 0                            |
| Empty/whitespace utterances          | Handled (3 guards: `:221-223`, `:494-495`, `soniox-stream.ts:156-160`)     |
| Soniox `<end>` vs our pause          | No conflict: gate flush, not finals; keep Soniox endpointing on            |
| Pause ≥ `VAD_SILENCE_CLOSE_MS`       | Keep socket-close > max pause (bump to ~3000–3500) so late resumes merge   |
| Ripple UI after VAD swap (Phase 2)   | Keep raw RMS feed even if vad-web owns VAD logic                           |
| iOS AudioContext suspend / track-end | Existing recovery (`soniox-stream.ts:786,832`) must survive worker/model   |
| ONNX blocking main thread (Phase 2)  | Web Worker, single-thread WASM, bundle assets locally                      |
| Prebuffer double-count w/ vad-web    | Reconcile pre-speech pad vs existing 1.5s prebuffer (`:624`)               |
| STT cost of longer socket window     | Real tradeoff — note when bumping `VAD_SILENCE_CLOSE_MS`                   |
| Detector cleanup on mic-off/unmount  | Mirror existing timer cleanup (`:520-533`); tear down worker too (Phase 2) |

---

## 9. Test strategy

- **Pure reducers in node env** (`turnDecision.ts`): `isSemanticEndOfTurn`, `shouldFlushTurn` —
  table-driven, like `updateVad` / `isRecoverableVoiceError` tests.
- **Timing in jsdom** with `vi.useFakeTimers()` + `advanceTimersByTime` — extend
  `useCoachChat.aggregation.test.tsx` to assert: complete-text flushes early, incomplete-text extends,
  hard-cap fires, interim re-arm still merges.
- **Make pause + detector injectable** into the hook so tests vary them without editing constants.
- Phase 2 model: snapshot-test feature-extraction + a fixed-input inference in a worker harness; keep
  the audio tap a pure transform.

---

## 10. Success metrics (read after Phase 0, then Phase 1)

- **False-cutoff rate** ↓ — proxy: `coach_turn_resumed` frequency + `coach_barge_in` shortly after coach
  TTS start.
- **End-of-turn latency** ↓ for clearly-complete turns — `coach_turn_completed.ms_since_last_final`
  split by `decided_by`.
- **No regression** in turn-merge correctness (multiple finals still become one turn).

---

## 11. Key files (reference)

| Concern                                    | File                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| Turn orchestrator / aggregation / barge-in | `src/hooks/useCoachChat.ts`                             |
| LLM stream + abort                         | `src/hooks/useLLM.ts`                                   |
| Audio capture + VAD + Soniox transport     | `src/lib/services/soniox-stream.ts`                     |
| Mic gate / restart budget                  | `src/hooks/useVoiceInCapture.ts`                        |
| TTS stop / barge-in semantics              | `src/lib/services/tts-service.ts`                       |
| Numeric voice config (pause default home)  | `src/config/voiceConfig.ts`                             |
| Ripple metrics                             | `src/stores/audioMetricsStore.ts`                       |
| New pure turn-decision module (Phase 1)    | `src/lib/voice/turnDecision.ts` _(to create)_           |
| Aggregation timing test                    | `src/hooks/__tests__/useCoachChat.aggregation.test.tsx` |
| Soniox pure-core test (DI pattern)         | `src/lib/services/__tests__/soniox-stream.test.ts`      |

---

## 12. Decisions locked

- Scope now: **Phase 0 + Phase 1**.
- Detector: **heuristic first** (escalate to smart-turn only on metric evidence).
- Pause: **internal constant** in `voiceConfig.ts` (no user preference yet).
- Full-duplex (Phase 3): **deferred**, gated on iOS AEC proof.
