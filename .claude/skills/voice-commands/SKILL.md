---
name: voice-commands
description: Voice-command pipeline for home check-in, journal voice input, onboarding chat overlay, and feedback voice notes — Cartesia REST STT + GPT-4o-mini NLU + ActionDispatcher + DataService + REST TTS. Auto-invoked when working on useVoiceChat / useVoiceCommand / useVoiceInput / useOnboardingVoice / VoiceCheckInOverlay / FreeformEntry / OnboardingChatOverlay / FeedbackSheet / api/process-command / api/cartesia-stt / api/cartesia-tts / action-dispatcher / voice-command-system prompt. NOT for the Cartesia Line agent (that's `voice-assistant`).
user-invocable: false
---

# Voice Command Pipeline

The text-command-style voice path: user speaks a short utterance, we transcribe it, parse it into a structured intent, and execute one CRUD action. **Distinct from [voice-assistant](../voice-assistant/SKILL.md)**, which is the realtime conversational Cartesia Line agent used during onboarding step pages. Both pipelines are live in production and serve different surfaces.

## Surfaces (where this pipeline runs)

| UI | Hook chain | File |
|----|------------|------|
| Home voice check-in | `Layout.tsx` mounts `VoiceCheckInOverlay` → `useVoiceChat` → `useVoiceCommand` + `useVoiceInput` | `src/components/home/VoiceCheckInOverlay.tsx` |
| Journal voice input | `FreeformEntry` → `useVoiceInput` (transcript only, no NLU) | `src/components/journal/FreeformEntry.tsx` |
| Onboarding chat overlay | `OnboardingChatOverlay` → `useOnboardingVoice` + `useVoiceInput` | `src/components/onboarding/OnboardingChatOverlay.tsx` |
| Feedback voice note | `FeedbackSheet` → `stt-service` direct | `src/components/home/FeedbackSheet.tsx` |

## Architecture

```
Mic (getUserMedia) → stt-service.ts (PCM upload)
  → POST /api/cartesia-stt → transcript
    → useVoiceCommand.processTranscript()
      → localParse() (regex fallback) OR POST /api/process-command (gpt-4o-mini)
        → { action, entity, params, confidence }
          → ActionDispatcher → DataService (Supabase or Mock)
            → optional TTS reply via tts-service.ts → POST /api/cartesia-tts → audio
              → UI updates (toast, store, navigation)
```

## Reference Files

- [prompt-engineering.md](prompt-engineering.md) — `/api/process-command` system prompt: 21 few-shot examples, 17 parse rules, validation results, cost analysis
- [test-scenarios.md](test-scenarios.md) — 30 voice-command scenarios across 3 tiers (CRUD / parameterized / contextual)
- [schema-erd.md](schema-erd.md) — DB schema reference (general project DB, not voice-specific)

## Key Files

| Layer | File |
|-------|------|
| STT REST handler | `api/cartesia-stt.ts` |
| TTS REST handler | `api/cartesia-tts.ts` |
| NLU REST handler | `api/process-command.ts` |
| NLU prompt | `src/lib/prompts/voice-command-system.ts` |
| Browser STT | `src/lib/services/stt-service.ts` |
| Browser TTS | `src/lib/services/tts-service.ts` |
| Intent → CRUD | `src/lib/services/action-dispatcher.ts` |
| Dispatcher rules | `src/lib/config/dispatcher-config.ts` |
| Voice tunables | `src/lib/config/voice.ts` |
| Local parser | `src/hooks/useVoiceCommand.ts:localParse()` |

## Naming Trap — Read This

`api/cartesia-stt.ts` and `api/cartesia-tts.ts` *sound* like they belong to the Cartesia Line agent (`voice-assistant`). They don't. They're plain REST endpoints owned by THIS pipeline. The Cartesia Line agent does its own STT and TTS internally over its WebSocket — it never hits `/api/cartesia-stt` or `/api/cartesia-tts`. If you're tracing a request to those endpoints, you're in the voice-commands flow, not voice-assistant.

## Shared With voice-assistant

These primitives are consumed by BOTH pipelines. Editing any of them affects both surfaces — check both before changing behavior.

| Primitive | What it does | Consumers |
|-----------|--------------|-----------|
| `src/lib/services/tts-service.ts` | Browser TTS playback (calls `/api/cartesia-tts`) | This pipeline + ~17 random UI components (toasts, check-in cards, feedback button, etc.) |
| `src/contexts/VoiceContext.tsx` + `src/hooks/useVoice.ts` | Mutual-exclusion lock between voice modes | Both pipelines |
| `src/stores/voiceSettingsStore.ts` | Recording mode, TTS toggle, voice preference | Both pipelines + Settings UI |
| `src/stores/voiceStore.ts` | Listening / transcript / interim state | Both pipelines |

If you're touching `tts-service.ts` or any of the stores, check that the change makes sense for the realtime agent path too. Don't assume voice-commands "owns" them.

## Decisions Worth Remembering

- **STT provider is Cartesia**, via `/api/cartesia-stt`. The earlier Web Speech API / DeepGram / Whisper evaluation was POC-era and got overruled — don't reopen that comparison without a real reason.
- **NLU model is `gpt-4o-mini`** at temperature 0.1, `response_format: json_object`. Same prompt for all surfaces. Validation: 30/30 scenarios across 3 tiers.
- **Local parser exists as a fallback** in `useVoiceCommand.localParse()` — if `/api/process-command` is unavailable, we degrade to regex parsing instead of erroring. Keep both paths working.
- **Single-action only** — one intent per transcript. Multi-intent is intentionally not supported.
- **Confidence calibration** — 0.9+ execute silently, 0.7–0.89 execute with toast, 0.5–0.69 confirm before executing, <0.5 reject.

## Don't Confuse With voice-assistant

| | voice-commands (this skill) | voice-assistant |
|---|---|---|
| Triggered by | tap-to-talk on home / journal / onboarding overlay / feedback | onboarding step page mount |
| Transport | REST (`/api/cartesia-stt`, `/api/process-command`, `/api/cartesia-tts`) | WebSocket (`wss://api.cartesia.ai/agents/stream`) |
| Model | `gpt-4o-mini` (one-shot intent parse) | LLM hosted in Cartesia Line agent (multi-turn coaching) |
| Persistence | direct DataService writes | tool calls inside the agent → Supabase REST → Realtime → UI |
| Conversation | no — single utterance, single action | yes — turn-based dialogue |

If a task involves the onboarding step pages or `useOnboardingAgent`, use voice-assistant instead.
