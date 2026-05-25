# Onboarding Chat Overlay — Speaker-State Wiring + Parasitic-Mic Bug Fix

**Date:** 2026-05-21
**Branch:** `fix/dual-button-vapi-lifecycle` (continues prior work)
**Scope:** Path-1 onboarding overlay only. Path-2 (check-ins) and Path-3 (text chat) unchanged.

---

## Problem

Four behaviors the onboarding overlay is supposed to have but doesn't:

1. **Open Chat opens the overlay only.** Today: same. Confirmed correct. No change needed — listed for completeness.
2. **The overlay closes when either voice or mic is toggled OFF** (including the provider's 8 s idle auto-off in `OnboardingVoiceProvider.tsx:352-359`). Today: overlay only closes via the X button, Escape, or swipe-down. Toggle-off does not close it.
3. **Both dual buttons** (the one inside the overlay AND the bottom one in `OnboardingLayout`) **flicker on the right side when the user is speaking**, mirroring how the left side flickers when the AI speaks. Today: neither right side flickers correctly during a Vapi turn — the in-overlay one is driven by a dead signal (`useVoiceInput().isListening` is always false during Vapi), and the bottom one has no right-side wiring at all.
4. **The overlay background gradient is yellow when the user is speaking and blue when the AI is speaking.** Today: both gradients exist (`LISTENING_GRADIENT`, `IDLE_GRADIENT` at `OnboardingChatOverlay.tsx:40-44`) but are gated on the same dead `useVoiceInput().isListening`, so during Vapi onboarding the gradient stays blue regardless of who's talking.

**Plus one concrete bug** the user reported: _"the mic will hear everything and it will be turned on for some reason always."_ Root cause confirmed in code (see below).

## Root cause of the "always listening" bug

`OnboardingChatOverlay.tsx:160-174` auto-starts a **second** mic capture in parallel with Vapi:

```ts
useEffect(() => {
  if (!micRuntimeOn) { if (isListening) toggle(); return; }
  if (!isListening && !isProcessing && !isSpeaking) {
    const timer = setTimeout(() => {
      if (!useTtsPlaybackStore.getState().isSpeaking && !isProcessing) {
        unlockTTS();
        toggle();          // starts Cartesia stt-service via useVoiceInput
      }
    }, 300);
    return () => clearTimeout(timer);
  }
}, [...]);
```

`toggle()` → `useVoiceInput.ts:93 startRecording()` → opens a second `getUserMedia` and runs the Cartesia worklet, which pushes RMS into `audioMetricsStore` on every chunk (`stt-service.ts:286,361`, `audioMetricsStore.ts:30-37`). VAD threshold is 0.005 — ambient-noise sensitive. So once mic permission is granted in onboarding, two captures run forever:

- Vapi's getUserMedia (the legitimate one)
- Cartesia's getUserMedia (the parasite — wakes on any ambient noise)

There's even a downstream band-aid at `:217-220` (`if (vapiActive) { resetTranscript(); return; }`) — the author knew Cartesia transcripts shouldn't be acted on during Vapi but suppressed the _symptom_ (transcript fan-in) without disabling the _cause_ (capture).

## Solution overview

- **Hoist** the speaker-state signal into `OnboardingVoiceProvider` so both dual buttons can read it (`isAssistantSpeaking` already lives there; add `isUserSpeaking`).
- **Derive** `isUserSpeaking` from Vapi user-transcript partials with a 600 ms idle expiry. No new instrumentation — partials already stream through `subscribeTranscripts`.
- **Rewire** the overlay's gradient and the in-overlay dual button's `activeRings` to the provider signals.
- **Wire** the bottom dual button's right-side rings to `micOn && isUserSpeaking` (its left side already reads `vapiSpeaking`).
- **Remove** `useVoiceInput()` and its 300 ms auto-start from `OnboardingChatOverlay` — kills the parasitic capture and eliminates a getUserMedia lease + worklet during onboarding.
- **Add** a transition-based close effect to the overlay: when `voiceOn` or `micOn` transitions ON→OFF while the overlay is mounted, call `onClose()`. Steady-state OFF at mount does not trigger close (preserves the future "open chat with toggles off → type" path).

## State model

| Signal                 | Owner                              | Source                                                                    | Truth                                        |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `isAssistantSpeaking`  | Provider (existing)                | Vapi `speech-start`/`-end` (assistant-only per `useRealtimeVoice.ts:419`) | AI talking now                               |
| `isUserSpeaking` (NEW) | Provider                           | Vapi user-partial transcripts via `handleTranscript`, 600 ms expiry       | User talking now                             |
| `status`               | Provider (existing)                | `useRealtimeVoice.state` mapped                                           | `idle / connecting / active / ended / error` |
| `voiceOn`, `micOn`     | `useDualButtonControls` (existing) | Supabase preferences                                                      | Toggle state                                 |

**Why partial transcripts (option A) over RMS-from-Vapi (option B) or inversion (option C):**

- (A) Free — partials already stream. Accurate. ~200–400 ms latency (Vapi STT cadence) — invisible at the gradient level given the 300 ms CSS transition.
- (B) Lower latency but reaches into Daily SDK internals via `getClient()`; brittle on upstream upgrades; re-introduces a worklet to maintain.
- (C) Inaccurate — "Vapi active && not assistant speaking" includes silence after AI finishes, would look like user speaking.

## Component changes

### `src/contexts/useOnboardingVoiceSession.ts`

Add to `OnboardingVoiceContextValue`:

```ts
isUserSpeaking: boolean;
```

### `src/contexts/OnboardingVoiceProvider.tsx`

- `const [isUserSpeaking, setIsUserSpeaking] = useState(false)`
- `const userActiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
- In `handleTranscript` (`:231-239`), before the listener fan-out:
  ```ts
  if (evt.role === 'user' && evt.kind === 'partial') {
    if (userActiveTimerRef.current) clearTimeout(userActiveTimerRef.current);
    setIsUserSpeaking(true);
    userActiveTimerRef.current = setTimeout(() => {
      userActiveTimerRef.current = null;
      setIsUserSpeaking(false);
    }, 600);
  }
  ```
- New effect: when `status !== 'active'`, clear the timer and `setIsUserSpeaking(false)`. Prevents stuck-true if Vapi tears down mid-utterance.
- Extend unmount cleanup at `:277-282` to also clear `userActiveTimerRef`.
- Add `isUserSpeaking` to the `value` memo at `:413-435` (object + dep list).

### `src/components/onboarding/OnboardingLayout.tsx`

- `const vapiUserSpeaking = onboardingVoice?.isUserSpeaking ?? false;`
- Bottom `DualButton` `activeRings` (`:160`), change from:
  ```ts
  activeRings={ttsOn && vapiSpeaking ? 'left' : null}
  ```
  to:
  ```ts
  activeRings={
    ttsOn && vapiSpeaking
      ? 'left'
      : micOn && vapiUserSpeaking
        ? 'right'
        : null
  }
  ```

(Bottom button stays gradient-free; this is the only change.)

### `src/components/onboarding/OnboardingChatOverlay.tsx`

**Removals:**

- Imports: `useVoiceInput`, `useAudioMetricsStore`, `useTtsPlaybackStore` (only used in removed code).
- The `useVoiceInput()` call (`:64`).
- Error-mirror effect (`:107-111`).
- 300 ms Cartesia auto-start effect (`:160-174`) — **the bug**.
- Cartesia transcript-completion effect (`:203-237`) and the `processedTranscriptRef` it owns.
- `intensity` prop on the in-overlay `DualButton` (`:413`) — no RMS source after the removal.
- `interim` eyebrow render (`:395-399`).
- Inside `handleClose`: drop the `if (isListening) toggle()` and `resetTranscript()` calls. Becomes just `onClose()`.

**Provider reads:**

```ts
const onboardingVoiceSession = useOnboardingVoice();
const vapiActive = onboardingVoiceSession?.status === 'active';
const isAssistantSpeaking = onboardingVoiceSession?.isAssistantSpeaking ?? false;
const isUserSpeaking = onboardingVoiceSession?.isUserSpeaking ?? false;
```

**Rewires:**

```ts
const voiceState: 'speaking' | 'listening' | 'idle' = isAssistantSpeaking
  ? 'speaking'
  : isUserSpeaking
    ? 'listening'
    : 'idle';
```

In-overlay `DualButton`:

```ts
activeRings={
  micRuntimeOn && isUserSpeaking
    ? 'right'
    : voiceChosen && isAssistantSpeaking
      ? 'left'
      : null
}
```

Gradient formula at `:326` unchanged textually (`voiceState === 'listening' ? LISTENING_GRADIENT : IDLE_GRADIENT`) — now driven by Vapi.

**New: close-on-toggle-off-transition effect:**

```ts
const prevVoiceOnRef = useRef(voiceChosen);
const prevMicOnRef = useRef(micRuntimeOn);
useEffect(() => {
  const voiceWentOff = prevVoiceOnRef.current && !voiceChosen;
  const micWentOff = prevMicOnRef.current && !micRuntimeOn;
  if (voiceWentOff || micWentOff) onClose();
  prevVoiceOnRef.current = voiceChosen;
  prevMicOnRef.current = micRuntimeOn;
}, [voiceChosen, micRuntimeOn, onClose]);
```

Transition-based, not steady-state: catches manual toggle-off and the provider's 8 s auto-off, but does not trigger if the overlay opens with toggles already off (future text path).

## Out of scope (deferred)

- With rule 2 enforced, `textOnlyMode` in `OnboardingChatOverlay.tsx:84` is unreachable from this overlay. The `textOnlyMode` branches in `handleSendText` (`:241-246`), the llm-mirror (`:255-264`), llm-error (`:266-272`), and tool-event router (`:275-298`) become dead code. Removing them is a separate simplification PR.
- `handleSendText`'s `!textOnlyMode` branch still calls `runAssistant` (REST `processTranscript`) while Vapi is live — pre-existing double-path. Not in scope.
- Optional symmetry: render a live user-partial bubble (today only assistant partials render via `partialAssistant`). Easy follow-up.

## Verification (manual — no automated tests)

Existing suite is Node-env unit only. These changes are integration-level (Vapi runtime + browser audio).

1. **Open Chat with both on** → rings/gradient track Vapi. Yellow + right-ring pulse when user speaks; left-ring pulse during AI; gradient stays blue when AI is speaking (idle === AI on the gradient by spec).
2. **Open Chat with mic off** → opens, stays open, gradient blue, no rings.
3. **Inside overlay, toggle mic off** → overlay closes.
4. **Inside overlay, toggle voice off** → overlay closes.
5. **Inside overlay, idle 8 s** → provider auto-flip → overlay closes.
6. **System mic indicator + `chrome://media-internals/`** → single active getUserMedia track, indicator appears only when Vapi connects. Before fix: two tracks, indicator on immediately after the 300 ms timer.
7. **Outside overlay, bottom dual button** → left rings during AI speech, right rings during user speech; both idle when Vapi isn't `active`.

## Risks

- **User-partial lag (~200–400 ms).** Acceptable; gradient transition is 300 ms already (`:336`).
- **Barge-in (user + AI overlapping).** Both flags can be true. Gradient and bubble color resolve by precedence (AI wins on gradient). Both ring sides can pulse simultaneously — visually correct.
- **Vapi retry / reconnect.** Provider's `status !== 'active'` effect clears `isUserSpeaking` between connections; resumes naturally on reconnect.
