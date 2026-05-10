# Path 2 — Current Cartesia REST + GPT-4o-mini Implementation (Legacy)

What's wired today. **Do not extend.** Reference for reading existing code, debugging the live MVP, and planning the migration to `callLLM()`.

## Today's pipeline

```
Mic (getUserMedia) → src/lib/services/stt-service.ts (PCM upload)
  → POST /api/cartesia-stt (Cartesia Ink REST) → transcript
    → useVoiceCommand.processTranscript()
      → localParse() (regex fallback) OR POST /api/process-command (gpt-4o-mini)
        → { action, entity, params, confidence }
          → ActionDispatcher → DataService (Supabase or Mock)
            → optional TTS reply via tts-service.ts → POST /api/cartesia-tts → audio
              → UI updates (toast, store, navigation)
```

## File map

### Vercel functions

| File | Purpose | Migration target |
|---|---|---|
| `api/cartesia-stt.ts` | One-shot STT for the voice-command pipeline. POSTs to Cartesia Ink. | Likely renamed (`api/stt.ts`) but logic stays. |
| `api/cartesia-tts.ts` | One-shot TTS. POSTs `https://api.cartesia.ai/tts/bytes`. | Likely renamed (`api/tts.ts`) but logic stays. |
| `api/process-command.ts` | GPT-4o-mini NLU. Parses transcript → `{ action, entity, params, confidence }`. | Folds into `callLLM()` with `screen_contexts` ctx. |

### Browser-side

| File | Purpose |
|---|---|
| `src/lib/services/stt-service.ts` | `getUserMedia` → PCM → upload to `/api/cartesia-stt`. |
| `src/lib/services/tts-service.ts` | Browser TTS playback; calls `/api/cartesia-tts`. **Used by ~17 UI components**, not just Path 2. |
| `src/lib/services/action-dispatcher.ts` | Maps `{action, entity, params}` → DataService method calls. |
| `src/lib/config/dispatcher-config.ts` | Dispatcher rules (which action+entity → which method). |
| `src/lib/config/voice.ts` | Confidence tiers, recording-mode tunables. |
| `src/hooks/useVoiceCommand.ts` | Owns NLU call + local fallback parser. |
| `src/hooks/useVoiceInput.ts` | Transcript-only mode. |
| `src/hooks/useVoiceChat.ts` | Composes useVoiceCommand + useVoiceInput for the home check-in overlay. |
| `src/lib/prompts/voice-command-system.ts` | The 21-few-shot, 17-rule NLU system prompt. |

## NLU prompt — what's in `voice-command-system.ts`

Last validated 2026-03-04. Model: `gpt-4o-mini`, temperature 0.1, `response_format: json_object`.

- 21 few-shot examples across 3 tiers (CRUD / parameterized / contextual)
- 17 parse rules covering filler words, typos, casual speech, multi-utterance handling
- Confidence calibration guidelines (0.9+ clear / 0.7–0.89 likely / 0.5–0.69 guess / <0.5 unclear)
- "Never return unknown" rule — always emit best-guess + low confidence

Validation results: 30/30 scenarios pass (Tier 1: 11/11, Tier 2: 10/10, Tier 3: 9/9).

Performance:

| Metric | Value |
|---|---|
| Avg latency | 1118 ms |
| Avg tokens/call | 1628 |

Cost (current):

| Scale | Monthly cost |
|---|---|
| 100 daily users × 10 cmds | ~$18/mo |
| 500 daily users × 10 cmds | ~$92/mo |
| 1000 daily users × 10 cmds | ~$183/mo |

## Key design decisions

1. **STT provider is Cartesia (Ink)**, via `/api/cartesia-stt`. The earlier Web Speech API / DeepGram / Whisper evaluation was POC-era and got overruled — don't reopen that comparison without a real reason.
2. **NLU model is `gpt-4o-mini`** at temperature 0.1 with `response_format: json_object`. Same prompt for all surfaces.
3. **Local parser exists as a fallback** — if `/api/process-command` is unavailable, `useVoiceCommand.localParse()` does regex parsing instead of erroring. Keep both paths working until the migration decides whether to retain offline support.
4. **Single-action only** — one intent per transcript. Multi-intent is intentionally unsupported.
5. **Confidence calibration** — 0.9+ silent / 0.7–0.89 toast / 0.5–0.69 confirm / <0.5 reject.

## Test scenarios (`scripts/validate-prompt.ts`)

### Tier 1 — Simple CRUD

| # | Voice command | Parsed intent | Status |
|---|---|---|---|
| 1 | "Create a habit called meditation" | `create → habit { name: meditation }` | ✅ |
| 2 | "Add a metric called sleep quality" | `create → metric { name: sleep quality, inputType: binary }` | ✅ |
| 3 | "Mark meditation done for today" | `complete → habit { name: meditation, date: today }` | ✅ |
| 4 | "Delete the exercise habit" | `delete → habit { name: exercise }` | ✅ |
| 5 | "Show my habits" | `query → habit {}` | ✅ |

### Tier 2 — Parameterized

| # | Voice command | Status |
|---|---|---|
| 6 | "Create exercise, three times a week" | ✅ |
| 7 | "Add a metric for mood, scale 1 to 10" | ✅ |
| 8 | "Log my sleep quality as 8 out of 10" | ✅ |
| 9 | "Mark meditation done for Mon Tue Wed" | ⚠️ Multi-date not supported |
| 10 | "Rename exercise to morning workout" | ✅ |

### Tier 3 — Contextual / Analytical

| # | Voice command | Status |
|---|---|---|
| 11 | "How am I doing with meditation this month?" | ✅ |
| 12 | "What's my longest streak?" | ✅ |
| 13 | "I slept terribly and I'm feeling stressed" | ✅ (`reflect → journal`) |
| 14 | "Suggest a new habit for me" | ✅ |
| 15 | "Give me a weekly summary" | ⚠️ Local parser limited |

## Error handling (today)

| Scenario | Behavior |
|---|---|
| Unrecognized command | Toast: "I didn't understand that" |
| Missing habit name | Toast: "Missing name for creation" |
| Habit not found | Toast: `Habit "X" not found` |
| Empty/garbage name | Low confidence (0.3), rejected by dispatcher |
| No microphone access | Error shown in voice panel |

## Voice settings (today, persisted in localStorage via `voiceSettingsStore`)

| Setting | Options | Default |
|---|---|---|
| Recording mode | auto-stop / always-on | auto-stop |
| TTS Voice | All English voices | Best available |
| Talk-back toggle | on / off | on |

## Naming trap — `cartesia-stt` and `cartesia-tts` are NOT Path 1

These endpoint names suggest they belong to the legacy Cartesia Line agent (Path 1). They don't. They're Path 2's REST endpoints. The Cartesia Line agent does its own STT and TTS internally over WebSocket — it never hits `/api/cartesia-stt` or `/api/cartesia-tts`.

If you're tracing a request to those endpoints, you're in Path 2.

## Audio formats

| ID | Direction | Sample rate |
|---|---|---|
| `pcm_16000` | mic → server | 16 kHz, 16-bit LE mono |
| `wav` / `mp3` | server → speakers | varies (Sonic returns the format you request) |

## Cartesia version

`Cartesia-Version: 2026-03-01` header on the STT/TTS REST calls. Pinned in:
- `api/cartesia-stt.ts`
- `api/cartesia-tts.ts`

Bump together when Cartesia ships a breaking version. Coordinate with the Path 1 legacy code's `2026-03-01` pin until that retires.

## What changes when callLLM lands

- `/api/process-command` retires. Its NLU prompt becomes ctx for `callLLM()` (or merges with `screen_contexts.context_block` for the surfaces where intent parsing is screen-specific).
- The `{ action, entity, params, confidence }` shape stays — `callLLM()` returns the same structure plus an optional spoken-reply text for Shape D surfaces.
- The local regex parser becomes a fallback that bypasses callLLM (or retires, if offline UX changes).
- Confidence tiers stay in `voice.ts`, evaluated wherever the dispatcher is invoked.

## What stays unchanged

- Mic capture path (`stt-service.ts`).
- TTS playback path (`tts-service.ts`).
- ActionDispatcher + DataService.
- Confidence calibration tiers.
- 30 voice-command test scenarios (the prompt that produces them moves into ctx, but the success criteria are the same).
