# STT Provider Evaluation — Web Speech API vs DeepGram vs Whisper

> **Decision:** Use a **tiered approach** — Web Speech API as default (zero-cost), DeepGram nova-2 for production accuracy, Whisper WASM as offline fallback.

## Providers Tested

### 1. Web Speech API (`webkitSpeechRecognition`)

| Criterion           | Result                                                    |
| ------------------- | --------------------------------------------------------- |
| **Accuracy**        | ~85% on short commands, ~70% on longer sentences          |
| **Latency**         | ~200-500ms (real-time interim results)                    |
| **Cost**            | Free (browser-native)                                     |
| **Browser Support** | Chrome/Edge (full), Safari (partial), Firefox (❌)        |
| **Mobile**          | Chrome Android ✅, iOS Safari ✅ (intermittent)           |
| **Offline**         | ❌ Requires internet                                      |
| **Streaming**       | ✅ Native interim results                                 |
| **Edge Cases**      | Struggles with accented speech, command-style rapid input |

**Verdict:** Good enough for prototype and zero-cost testing. Unreliable on Firefox and some mobile browsers.

### 2. DeepGram Nova-2 (WebSocket Streaming)

| Criterion           | Result                                               |
| ------------------- | ---------------------------------------------------- |
| **Accuracy**        | ~95% on short commands, ~90% on longer sentences     |
| **Latency**         | ~150-300ms (streaming via WebSocket)                 |
| **Cost**            | Free tier: 200 min/month. Pay-as-you-go: $0.0043/min |
| **Browser Support** | All (WebSocket-based)                                |
| **Mobile**          | ✅ All mobile browsers via WebSocket                 |
| **Offline**         | ❌ Cloud-only                                        |
| **Streaming**       | ✅ Real-time via WebSocket (`interim_results: true`) |
| **Edge Cases**      | Handles accents well, smart formatting, punctuation  |

**Configuration used:**

```
model: 'nova-2'
language: 'en'
smart_format: true
interim_results: true
utterance_end_ms: 1500
vad_events: true
encoding: opus
sample_rate: 48000
```

**Verdict:** Best accuracy and latency. Recommended for production. Token-based authentication via serverless proxy (`/api/deepgram-token`).

### 3. Whisper (WASM / Faster Whisper)

| Criterion           | Result                                                     |
| ------------------- | ---------------------------------------------------------- |
| **Accuracy**        | ~92% on short commands, ~88% on longer sentences           |
| **Latency**         | ~1500-4000ms (batch processing, model load time)           |
| **Cost**            | Free (runs locally or self-hosted)                         |
| **Browser Support** | All (WASM), but heavy (~40MB model download)               |
| **Mobile**          | ⚠️ Heavy — may cause performance issues on low-end devices |
| **Offline**         | ✅ Fully offline after model download                      |
| **Streaming**       | ❌ Batch only (record → process → result)                  |
| **Edge Cases**      | Good accent handling, poor at very short commands (<2s)    |

**Verdict:** Best offline option. High latency makes it unsuitable as primary provider, but excellent as fallback. Minimum recording duration of 1s required to avoid empty transcripts.

## Comparison Matrix

| Feature             | Web Speech API | DeepGram Nova-2 | Whisper WASM |
| ------------------- | -------------- | --------------- | ------------ |
| Accuracy (commands) | ⭐⭐⭐         | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐     |
| Latency             | ⭐⭐⭐⭐       | ⭐⭐⭐⭐⭐      | ⭐⭐         |
| Cost                | ⭐⭐⭐⭐⭐     | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐   |
| Browser compat      | ⭐⭐⭐         | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐   |
| Mobile compat       | ⭐⭐⭐         | ⭐⭐⭐⭐⭐      | ⭐⭐         |
| Offline support     | ❌             | ❌              | ✅           |
| Streaming           | ✅             | ✅              | ❌           |

## Recommendation: Tiered Hybrid Approach

The app implements a **user-selectable STT provider** via Settings page (`voiceSettingsStore`):

```
SttProvider = 'webspeech' | 'whisper' | 'deepgram'
```

| Tier                 | Provider        | When                                                             |
| -------------------- | --------------- | ---------------------------------------------------------------- |
| **Default**          | Web Speech API  | Zero-cost, instant setup, good enough for most commands          |
| **Production**       | DeepGram nova-2 | When accuracy matters, streaming WebSocket, token via serverless |
| **Offline Fallback** | Whisper WASM    | When no internet or user prefers privacy                         |

## Cost Projection

| Daily Users | Commands/Day | Monthly Minutes | DeepGram Cost/Month |
| ----------- | ------------ | --------------- | ------------------- |
| 100         | 500          | ~83 min         | Free tier covers it |
| 500         | 2,500        | ~417 min        | ~$1.80              |
| 1,000       | 5,000        | ~833 min        | ~$3.58              |

## Implementation Files

- `src/stores/voiceSettingsStore.ts` — Provider selection + persistence
- `src/hooks/useVoiceInput.ts` — Unified hook switching between providers
- `src/lib/services/deepgram-stt.ts` — DeepGram WebSocket client (nova-2)
- `api/deepgram-token.ts` — Serverless token proxy (Vercel)
