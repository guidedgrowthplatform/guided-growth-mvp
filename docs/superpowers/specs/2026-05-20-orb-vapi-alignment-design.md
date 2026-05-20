# Orb–Vapi Alignment (Onboarding)

**Date:** 2026-05-20
**Scope:** Onboarding only (Path 1)
**Status:** Approved design, ready for implementation plan
**Authors:** Yonas (with Claude)
**Spec reference:** `gg-spec/docs/global-ux-rules.md` §3 (UX-26), commit `56b1da3`

---

## 1. Goal

Make the dual-button orb's two halves both gate the Vapi WebRTC session, per UX-26: Vapi runs **only** in State 1 (both ON). Tapping either half OFF tears down the session symmetrically. Fix three adjacent bugs caught while reading the code.

## 2. Background

The orb has two independent halves: left = AI output (TTS), right = mic (STT). The combination defines four engine states (UX-26 §3 of global-ux-rules.md). State 1 (both ON) is the only state where Vapi runs as a bundled WebRTC loop (LLM + STT + Cartesia). States 2/3/4 are Path 2 — composed app-code where LLM, Cartesia REST TTS, and Soniox/Cartesia STT are separate service calls. Toggling either half OFF in State 1 must tear down the Vapi session (intentional cost-conscious behavior).

**Current code gap:** today only the **left** half (AI output) tears down the Vapi session. The right half (mic) just mutes the live WebRTC track (`client.setMuted(!enabled)`) while the session keeps billing. Documented in `OnboardingVoiceProvider.tsx:325-328`:

> Vapi session lifecycle is owned by the LEFT orb (voiceMode) only. The mic orb is mute-only — it controls a runtime track on an already-live session and never starts or tears down the connection.

That comment is the design choice we are explicitly reversing.

## 3. Scope

**In:**

- `src/contexts/OnboardingVoiceProvider.tsx`
- `src/components/onboarding/OnboardingLayout.tsx`
- `src/components/onboarding/OnboardingChatOverlay.tsx`
- The four orb click handlers across those two components
- The provider's gate, auto-stop effect, and 8-second idle timer

**Out (deferred, documented in §12):**

- BottomNav orb (post-onboarding, no Vapi today)
- State-source duplication (`useUserPreferences` vs `voiceSettingsStore`)
- `setTtsEnabled` dead path
- Post-onboarding multi-state overlay design

## 4. Target state machine

| State | AI  | Mic | Engine running                                | Surface                     |
| ----- | --- | --- | --------------------------------------------- | --------------------------- |
| 1     | ON  | ON  | Vapi (LLM + STT + TTS bundled WebRTC)         | overlay open + chat bubbles |
| 2     | ON  | OFF | LLM + Cartesia REST TTS (via `speak()`)       | form screen + subtitle bar  |
| 3     | OFF | ON  | LLM + Cartesia REST STT (via `useVoiceInput`) | form screen + text reply    |
| 4     | OFF | OFF | LLM only                                      | `textOnlyMode` text chat    |

Invariant: any non-State-1 condition implies no Vapi session running.

## 5. The single gate (provider)

`src/contexts/OnboardingVoiceProvider.tsx:329` — replace:

```typescript
const voiceOff = preferences.voiceMode !== 'voice';
```

with:

```typescript
const vapiShouldRun =
  preferences.voiceMode === 'voice' &&
  preferences.micPermission === true &&
  preferences.micEnabled === true;
```

Then:

- Auto-start effect (line 334): swap `!voiceOff` → `vapiShouldRun`
- Auto-stop effect (line 399): swap `!voiceOff` → `!vapiShouldRun`

The auto-stop effect already calls `stop()` reactively when the gate flips false — it stays as belt-and-suspenders behind the imperative handlers. Update the comment at lines 325-328 to reflect the new model (both halves are session gates).

## 6. Handler protocol — uniform across all four

**OFF path (any orb half, Vapi active or connecting):**

1. `onboardingVoice.endCall()` — sets `didCallStopRef`, immediate `stop()`
2. `updatePreferences({ <relevant_pref>: <off_value> })`
3. `useVoiceSettingsStore.getState().hydrate({ <local_mirror>: false })`
4. If invoked from chat overlay: `onClose()`

**ON path (orb half toggles on):**

1. `updatePreferences({ <relevant_pref>: <on_value> })`
2. `useVoiceSettingsStore.getState().hydrate({ ... })`
3. If after this flip `vapiShouldRun` will be true (i.e. `voiceMode='voice' && micPermission=true && micEnabled=true`), call `onboardingVoice.restartCall()` to bypass the render-cycle lag in the auto-start effect.

**Important:** step 3 must be gated on the other half being already ON. Calling `restartCall()` when the gate is still false would spawn Vapi only to have the auto-stop effect (§5) immediately tear it down — a wasteful flicker. The existing left-orb handler at `OnboardingLayout.tsx:171` does NOT have this guard today (`if (nextChosen) restartCall()` always) and must be tightened.

## 7. Per-handler changes

### 7.1 `OnboardingLayout.handleTtsToggleClick` (lines 149-172)

**OFF path:** no semantic change. Already does endCall + pref-flip + hydrate when turning off mid-session.

**ON path:** tighten the `restartCall()` guard. Today line 171 unconditionally calls `restartCall()` whenever the user flips voice on. After this work, that would spawn Vapi even when the mic half is off — and the auto-stop effect would immediately tear it down. Change to:

```typescript
if (nextChosen && micGranted && preferences.micEnabled) {
  void onboardingVoice?.restartCall();
}
```

Update the inline comment to drop "session lifecycle owned by LEFT orb only" framing.

### 7.2 `OnboardingLayout.handleMicToggleClick` (lines 174-197)

**Add the OFF-when-active branch.** Today this branch calls `setMicEnabled(false)` which just mutes the WebRTC track. Replace with the OFF protocol:

```typescript
if (vapiActive || vapiConnecting) {
  onboardingVoice?.endCall();
  void updatePreferences({ micEnabled: false });
  useVoiceSettingsStore.getState().hydrate({ micEnabled: false });
  return;
}
```

Preserve the existing mic-permission-grant path (lines 183-194) — that fires when `micGranted=false` and is correct as-is.

ON path: flip `micEnabled: true`, hydrate the store, and if `voiceChosen` is true (we already know `micPermission=true` else we'd be in the grant path), call `restartCall()` to bypass the `status='ended'` lock from a prior `endCall()`.

```typescript
const turningOn = !preferences.micEnabled;
void updatePreferences({ micEnabled: turningOn });
useVoiceSettingsStore.getState().hydrate({ micEnabled: turningOn });
if (turningOn && voiceChosen) {
  void onboardingVoice?.restartCall();
}
```

**Why `restartCall()` is needed even though the auto-start effect exists:** `endCall()` sets `didCallStopRef.current = true`, which makes `status` become `'ended'` (not `'idle'`) after the session closes. The auto-start effect bails on `status !== 'idle'`, so it would never re-enter. `restartCall()` bypasses this by directly invoking `start()` and resetting the retry/fatal flags.

### 7.3 `OnboardingChatOverlay.handleToggleVoice` (lines 148-153)

**Currently flips pref only — no `endCall`, no `onClose`.** Bring up to protocol:

```typescript
const handleToggleVoice = useCallback(() => {
  const turningOff = voiceChosen;
  if (turningOff) {
    onboardingVoiceSession?.endCall();
    stopTTS();
    void updatePreferences({ voiceMode: 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: false });
    onClose();
    return;
  }
  void updatePreferences({ voiceMode: 'voice' });
  useVoiceSettingsStore.getState().hydrate({ ttsEnabled: true });
  // Only restart Vapi if mic is also on — else auto-stop effect would tear it
  // back down immediately (flicker).
  if (micRuntimeOn) {
    void onboardingVoiceSession?.restartCall();
  }
}, [voiceChosen, micRuntimeOn, updatePreferences, onboardingVoiceSession, onClose]);
```

### 7.4 `OnboardingChatOverlay.handleToggleMic` (lines 155-164)

**Add the Vapi-active OFF branch + overlay close:**

```typescript
const handleToggleMic = useCallback(() => {
  if (!micAllowed) return;
  if (vapiActive) {
    onboardingVoiceSession?.endCall();
    void updatePreferences({ micEnabled: false });
    useVoiceSettingsStore.getState().hydrate({ micEnabled: false });
    onClose();
    return;
  }
  // ON path: unlock TTS, stop current TTS, reset transcript, flip pref.
  // Also restart Vapi if voice mode is on (will satisfy the gate).
  const turningOn = !micRuntimeOn;
  if (turningOn) {
    unlockTTS();
    stopTTS();
    processedTranscriptRef.current = '';
  }
  void updatePreferences({ micEnabled: turningOn });
  useVoiceSettingsStore.getState().hydrate({ micEnabled: turningOn });
  if (turningOn && voiceChosen) {
    void onboardingVoiceSession?.restartCall();
  }
}, [
  micAllowed,
  micRuntimeOn,
  vapiActive,
  voiceChosen,
  onboardingVoiceSession,
  onClose,
  updatePreferences,
]);
```

## 8. Issue #2 fix — 8s auto-mute redesign

`OnboardingVoiceProvider.armIdleTimer` (lines 362-369). Today:

```typescript
void updatePreferences({ voiceMode: 'screen' });
stop();
```

After:

```typescript
void updatePreferences({ micEnabled: false });
// stop() removed — the auto-stop effect (lines 397-407) catches the gate flip
```

**Rationale:** 8 seconds of user silence is conceptually a mic-side event, not an AI-output event. Preserving `voiceMode` means the user can come back, tap-mic-only, and re-enter State 1 directly without re-flipping AI mode. Aligns with UX-16 ("sticky user-off" framing) — here it's the system flipping mic off, but the AI-mode intent persists.

**Behavior change:** after 8s silence, the AI orb half stays blue (showing user's preserved intent) and the mic half goes gray. Today: both go gray. Confirmed acceptable in brainstorming.

## 9. Issue #1 fix — dual-STT guard

`OnboardingChatOverlay` lines 181-195 — add `vapiActive` to the gate:

```typescript
useEffect(() => {
  if (vapiActive || !micRuntimeOn) {
    if (isListening) toggle();
    return;
  }
  if (!isListening && !isProcessing && !isSpeaking) {
    const timer = setTimeout(() => {
      if (!useTtsPlaybackStore.getState().isSpeaking && !isProcessing) {
        unlockTTS();
        toggle();
      }
    }, 300);
    return () => clearTimeout(timer);
  }
}, [vapiActive, micRuntimeOn, isListening, isProcessing, isSpeaking, toggle]);
```

When Vapi is running, `useVoiceInput`'s Cartesia STT stays off — Vapi owns the mic. The double-handling guard at line 238 (`if (vapiActive) { resetTranscript(); return; }`) becomes redundant but can stay as cheap insurance.

## 10. Issue #3 fix — `startAttemptedRef` re-entry

`OnboardingVoiceProvider` lines 142-144. Today the ref resets only on `currentScreenId` change. Add a transition-detector so mic-off → mic-on within the same screen unblocks the auto-start gate.

The naive version (capture-on-first-render with a `useRef(false)` seed) has a race: if `vapiShouldRun` is `true` on first render, the new effect would see `prev=false, curr=true` and reset `startAttemptedRef.current` AFTER the auto-start effect has already set it to `true` — causing a re-fire loop. Use a tri-state seed to skip the first-render comparison:

```typescript
const prevShouldRunRef = useRef<boolean | null>(null);
useEffect(() => {
  if (prevShouldRunRef.current === null) {
    prevShouldRunRef.current = vapiShouldRun;
    return;
  }
  if (vapiShouldRun && !prevShouldRunRef.current) {
    startAttemptedRef.current = false;
  }
  prevShouldRunRef.current = vapiShouldRun;
}, [vapiShouldRun]);
```

Place this effect immediately after the existing `currentScreenId`-reset effect (lines 142-144), before the auto-start effect (line 331). Both effects writing to `startAttemptedRef` are idempotent (both set it to false), and effect declaration order ensures the screen-change reset never trails the gate-transition reset within a single render.

Without this fix, the ref stays `true` after the first auto-start of a screen, and a rapid mic-off → mic-on would not re-enter Vapi because the auto-start effect bails on `startAttemptedRef.current === true`.

## 11. Edge cases / invariants

- **Pre-MIC-PERMISSION screens:** `micPermission=false` ⇒ gate prevents Vapi auto-start. Matches today's behavior (today the gate uses only `voiceMode`, but pre-permission screens also don't have voiceMode set to `voice` in practice).
- **`startAudioOff: true` (provider line 289):** Vapi starts muted. With the new gate requiring `micEnabled=true`, we can revisit whether this is still needed in a follow-up. Leaving untouched in this work.
- **Reconnect after error:** `restartCall()` (provider lines 492-502) resets retry budget + clears `fatalErrorRef`. No interaction with the new gate.
- **Race: pref flip + endCall both happen in same tick.** `endCall()` is synchronous; pref update is async (server round-trip). The auto-stop effect catches the pref flip on the next render. Both paths converge on `stop()`. `useRealtimeVoice.start()` guards against double-start via state check (lines 320-323) and `tearingDownRef`. `useRealtimeVoice.cleanup()` is idempotent via `tearingDownRef`. Safe.
- **Provider's reactive auto-stop (lines 397-407)** stays as backup. If a handler ever forgets to call `endCall()`, the gate flip still tears Vapi down via this effect.
- **Toggling either orb half OFF inside the chat overlay** closes the overlay (per Q3 / UX-26 §3 "Chat overlay orb rendering"). The user returns to the underlying onboarding form screen, which renders in form variant for State 2/3/4.

## 12. Observed but deferred

- **Issue #4 — state-source duplication.** `useUserPreferences` (server-backed) and `useVoiceSettingsStore` (local Zustand) both store the same logical fields. The four orb handlers will continue to hand-sync via `hydrate()` calls. Real fix is a single derivation (provider derives the local store from prefs). Out of scope here because it requires touching every `voiceSettingsStore` consumer — a separate refactor.
- **Issue #5 — `setTtsEnabled` dead path.** Provider exposes a soft-TTS-mute via Vapi control message (lines 469-481). No caller uses it. Either delete or wire it for a use case in a follow-up.

## 13. What this work does NOT touch

- `useRealtimeVoice` internals (sensitive lifecycle, Daily SDK interaction)
- Bundled-routes / screen-context push pipeline
- Retry / fatal-error logic (`MAX_AUTO_RETRIES`, `isFatalVapiError`)
- Server-side voice preferences shape
- BottomNav orb (different state source, different paths)

## 14. Test plan

**New unit tests:** `src/contexts/__tests__/OnboardingVoiceProvider.test.tsx` (new file)

- Vapi auto-starts when gate is satisfied (`voiceMode='voice'`, `micPermission=true`, `micEnabled=true`)
- Vapi does NOT auto-start when `micPermission=false`
- Vapi does NOT auto-start when `micEnabled=false`
- Vapi tears down when `voiceMode` flips to `screen`
- Vapi tears down when `micEnabled` flips to `false`
- 8s idle timer flips `micEnabled=false` (not `voiceMode`)
- `startAttemptedRef` resets on gate false→true transition

**Adjusted e2e:** `e2e/voice-happy-path.spec.ts`

- Assert right-orb-off mid-session tears down Vapi
- Assert re-enabling either half restarts Vapi cleanly

**Manual smoke (UI work, can't be fully replaced by automation):**

- Onboarding from clean state through MIC-PERMISSION → Vapi enters → toggle mic off → Vapi disconnects → toggle mic on → Vapi reconnects.
- Same flow exercising the AI orb half.
- Open chat overlay → toggle either half off → overlay closes + Vapi disconnects.
- Sit idle 10s during Vapi listening → mic orb half goes gray, AI orb half stays blue.

## 15. Acceptance criteria

1. Tapping the right (mic) orb half OFF while Vapi is active tears down the WebRTC session within 100ms.
2. Tapping either orb half OFF inside the chat overlay closes the overlay AND tears down Vapi.
3. Vapi auto-start fires only when all three gate conditions are true (`voiceMode='voice'` AND `micPermission=true` AND `micEnabled=true`).
4. After 8 seconds of user silence during Vapi listening, only `micEnabled` flips to false (not `voiceMode`); Vapi tears down via the gate.
5. When both orbs are ON in the chat overlay, only Vapi's STT is capturing audio (no parallel Cartesia STT via `useVoiceInput`).
6. Mic-off → mic-on within the same onboarding screen successfully re-enters Vapi (no `startAttemptedRef` lock).
7. All existing unit + e2e tests still pass.
8. New provider unit tests pass.
