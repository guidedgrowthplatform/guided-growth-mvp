# Hooks

Per-hook reference for the voice, session, and LLM layers. Each section
covers: **Signature / Purpose / State machine (if any) / Side effects /
Cleanup contract / Consumers**.

## Voice

### useRealtimeVoice

Vapi-backed realtime voice for Path 1 onboarding. Owns the
`@vapi-ai/web` client lifecycle, telemetry (PostHog + session_log),
VoiceContext token plumbing, and the spec-named state fields
(`isListening`, `isSpeaking`, `error`).

**Signature**

```ts
useRealtimeVoice({
  metadata: { user_id, screen?, coaching_style? },
  onEnd?: () => void,
  onError?: (msg: string) => void,
}) => {
  start, stop,
  state: 'idle'|'connecting'|'listening'|'thinking'|'speaking'|'error',
  isActive, isListening, isSpeaking, error,
}
```

**State machine** (Vapi events → state)

| State        | Driven by                                                    |
| ------------ | ------------------------------------------------------------ |
| `idle`       | initial; end of `cleanup()`                                  |
| `connecting` | `start()` entry, after `acquireRealtime`                     |
| `listening`  | `call-start`; `speech-end`                                   |
| `speaking`   | `speech-start` (only on transition from non-speaking)        |
| `error`      | `error` event, `call-start-failed`, or pre-start env-missing |

`'thinking'` is preserved in the type literal but never entered — Vapi
exposes no STT-finished-pre-LLM event.

**Metadata passthrough.** `client.start(ASSISTANT_ID, { variableValues:
{ user_id, screen, canonical_screen_id, coaching_style } })`. The
dashboard assistant prompt consumes `{{screen}}` / `{{user_id}}` and
forwards `variableValues` to the `before_llm_call` webhook (P1-11).

**Side effects**

| Surface     | Event                    | Trigger                                          | Payload                                                                                                         |
| ----------- | ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| PostHog     | `start_voice_session`    | first `call-start`                               | `{ context, screen, voice_mode: 'realtime', voice_vendor: 'vapi' }`                                             |
| PostHog     | `complete_voice_session` | graceful `call-end`                              | `{ context, duration_seconds, turn_count, transcript_length_chars, voice_vendor: 'vapi', vapi_first_audio_ms }` |
| PostHog     | `cancel_voice_session`   | `error` / `call-start-failed` after `call-start` | `{ context, duration_seconds, reason: 'error', voice_vendor: 'vapi' }`                                          |
| session_log | `voice_started`          | first `call-start`                               | `(canonicalScreenId)` → returns `anchorId`                                                                      |
| session_log | `voice_ended`            | cleanup, only if anchor exists                   | `(anchorId, 'user_exit' \| 'error', { turn_count })`                                                            |

- `turn_count` increments only on transitions INTO `speaking`.
- `transcript_length_chars` accumulates from `message` events with
  `type === 'transcript'` and `transcriptType === 'final'`. Schema
  mismatches fall back to `0` with a one-shot `console.warn`.
- `vapi_first_audio_ms` = `performance.now()` between `start()` invocation
  and the first `speech-start` event.

**Cleanup contract** (covers unmount, navigate-away, `call-end`
firing synchronously from `client.stop()`)

1. `tearingDownRef` guard — bail if already tearing down.
2. Emit close telemetry (gated on `sessionStartRef !== null`); clear refs.
3. Null `vapiRef.current` **before** SDK teardown.
4. `client.removeAllListeners()` **before** `client.stop()`.
5. `void client.stop()` — async; not awaited.
6. `setStateSynced('idle')`.

Token release happens in `stop()` **after** `cleanup()` so the
VoiceContext `onCleanup` cannot re-enter the hook while listeners are
still wired.

**Consumers** — `useOnboardingAgent` (used by 11 onboarding pages),
`VapiTestPage` (dev smoke).

### useOnboardingAgent

Per-screen wrapper around `useRealtimeVoice`. Builds the
`metadata: { user_id, screen, coaching_style: 'warm' }` payload, gates
auto-start on `useVoiceContext().mic_permission` (skipping the browser
Permissions API on `Capacitor.isNativePlatform()`), and stops on unmount.
Returns `{ voiceState, voiceError }`.

### useVoicePlayer

_Documented in Path 2 skill (async voice composition for check-ins)._

### useVoiceChat

_Documented in Path 2 skill (async voice composition for check-ins)._

### useVoice / VoiceContext

Tokenized voice-channel mutex. `acquireRealtime({ surface, onCleanup })`
returns a `ReleaseToken` (or `null` if another surface holds the
channel); `setStatus(token, phase)` advances the realtime owner phase;
`releaseToken(token)` hands the channel back.

## Session

### useSessionLog

`startVoice(screen_id?, extra?)` returns an `anchorId` and queues a
`voice_started` event; `endVoice(anchorId, reason, extra?)` queues the
paired `voice_ended`. Similar pair for broadcast playback
(`startBroadcast` / `endBroadcast`).

## LLM (Path 3)

### callLLM

Direct LLM path used by text chat surfaces and tap-driven LLM use cases.
See the `voice-architecture` skill; this section is filled in by P1-15.
