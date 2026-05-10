---
name: path-2-async
description: Path 2 — Async voice composition for daily check-ins, single-utterance commands, transcript-only voice input, and any pre-recorded prompt + reply loop. Composition is MP3 prompt (or Sonic REST) → user reply → Cartesia Ink (STT) → callLLM → LLM → Sonic API (TTS) → user. Side effects via ActionDispatcher → DataService → Supabase. Auto-invoked when working on morning/evening check-ins, VoiceCheckInOverlay, EditHabitPage / useAdvancedPath (advanced-flow voice input), OnboardingLayout shared mic, useVoiceChat / useVoiceCommand / useVoiceInput, /api/cartesia-stt, /api/cartesia-tts, /api/process-command (legacy), action-dispatcher, voice-command-system prompt, useVoicePlayer, MP3 voice manifest, or affirmation playback. NOT for onboarding (path-1-vapi) or pure text chat (path-3-direct-llm).
user-invocable: false
---

# Path 2 — Async Reflection (Daily Check-ins)

Asynchronous voice composition. The user hears a prompt (pre-recorded MP3 if available, otherwise live Sonic REST), speaks a reply, the reply is transcribed by Cartesia Ink, run through `callLLM()`, and the LLM's response is spoken back via Sonic API. **Single turn — one prompt, one reply, one response.** Multi-turn conversation is Path 1's job.

```
User → Frontend → MP3 prompt (plays to user)
                → user speaks reply
                → Cartesia Ink (STT)
                → callLLM()
                → LLM
                → Sonic API (TTS)
                → User

Side effects: callLLM result → ActionDispatcher → DataService → Supabase → UI updates
```

## Reference files

- [composition.md](composition.md) — the MP3 → mic → Ink → callLLM → Sonic loop in detail, plus how to skip pieces (transcript-only, broadcast-only, etc.)
- [surfaces.md](surfaces.md) — every Path 2 surface (target + today's overlap with the legacy single-utterance pipeline)
- [current-cartesia-rest.md](current-cartesia-rest.md) — what's wired today (`/api/cartesia-stt`, `/api/cartesia-tts`, `/api/process-command` GPT-4o-mini NLU, ActionDispatcher) — preserve while reading existing code, do not extend

## Migration posture

| | Today | Target |
|---|---|---|
| Prompt audio | Cartesia Sonic REST live, every time | Pre-recorded MP3 from Supabase Storage when text is fixed; Sonic REST when text is dynamic |
| STT | `/api/cartesia-stt` (Ink REST wrapper) | Same — Ink REST endpoint, possibly renamed |
| Intent / response | `/api/process-command` (GPT-4o-mini NLU, single-action intent) | `callLLM()` — same model family or Anthropic, with `screen_contexts` + `session_log` delta prepended |
| TTS | `/api/cartesia-tts` (Sonic REST wrapper) | Same — Sonic REST endpoint, possibly renamed |
| Side effects | `ActionDispatcher` in browser → `DataService` → Supabase | Same shape; may relocate dispatcher server-side as part of `callLLM()` |
| Local fallback | Regex `localParse()` in `useVoiceCommand` | Decision pending — keep for offline, or drop in favor of "tap to retry" UX |
| Confidence calibration | 0.9 silent / 0.7 toast / 0.5 confirm / <0.5 reject | Carry forward as either a callLLM contract or a wrapping dispatcher check |

**What survives:**
- The 8 ActionDispatcher operations (CRUD + query + reflect).
- Confidence tiers + UX rules per tier.
- Voice-command system prompt's intent shape (`{ action, entity, params, confidence }`).
- 30 voice-command test scenarios (`scripts/validate-prompt.ts`).
- Cartesia voice (same `voice_id` as Path 1).

**What evolves:**
- Single-utterance NLU folds into general callLLM (with screen_contexts ctx instead of a hardcoded prompt).
- Pre-recorded MP3 + Sonic REST coexist; the "is the text fixed?" decision picks between them per screen.

## Surfaces (target state)

| Surface | Composition | Notes |
|---|---|---|
| Morning check-in | MP3 prompt → mic → Ink → callLLM → Sonic | Replaces today's Line session for `metadata.screen='morning'` |
| Evening check-in | MP3 prompt → mic → Ink → callLLM → Sonic | Replaces today's Line session for `metadata.screen='evening'` |
| Home voice check-in (single utterance) | (no MP3) → mic → Ink → callLLM → Sonic | Today's voice-command pipeline lives here |
| Edit/add-habit voice input (advanced flow) | mic → Ink → (no LLM by default) → no TTS | Transcript-only — drops into form field |
| SPLASH-01 / PREF-01 / MIC-01 / POST-AUTH-01 | MP3 (when generated) → no mic → no LLM → no TTS | One-way broadcast. Today: live Sonic REST one-shot until MP3s exist. |
| Affirmation playback | text → Sonic REST → playback | Dynamic text, one-way |

See [surfaces.md](surfaces.md) for component → file mapping.

## Composition rules

Path 2 is a **construction kit**, not a fixed pipeline. Compose only the pieces a surface needs:

- **One-way broadcast** (splash, affirmation): MP3 or Sonic REST → playback. Skip mic, Ink, callLLM.
- **Transcript-only** (journal voice input, feedback): mic → Ink → drop transcript into form. Skip callLLM, Sonic.
- **Single-utterance command** (home check-in voice command): mic → Ink → callLLM → ActionDispatcher → optional Sonic. Skip MP3.
- **Full async loop** (morning/evening check-ins): MP3 prompt → mic → Ink → callLLM → Sonic → playback.

The diagram in [composition.md](composition.md) shows all four shapes side by side.

## Why not Path 1 for check-ins?

The diagram says morning/evening check-ins were intended for Vapi-style realtime, but the new design moves them to Path 2:

- Check-ins are **single-prompt, single-reply** in shape — the user doesn't need bidirectional turn-taking.
- Vapi session-minutes are billed for the whole open window. A 30-second async loop is cheaper as Ink + Sonic than as a Vapi session.
- Pre-recorded MP3 prompts give near-zero first-byte latency for the fixed opening line.
- callLLM + screen_contexts + session_log gives the same "AI knows where the user is and what they did" as Path 1, without the realtime infra.

If a check-in genuinely needs multi-turn dialogue (the user wants to keep talking, the assistant should ask follow-ups), it's no longer Path 2 — it becomes Path 1 (Vapi). But the MVP target is single-prompt single-reply.

## Side effects — ActionDispatcher

The `ActionDispatcher` is the keystone for Path 2's CRUD. It maps a parsed intent (`{ action, entity, params, confidence }`) to a `DataService` method call and writes to Supabase. Today it runs in the browser; under callLLM it may relocate server-side.

Operations: `create | complete | delete | query | log | update | suggest | reflect`. Entities: `habit | metric | journal | summary`.

Confidence calibration tiers (preserve through migration):
- **0.9+** — execute silently
- **0.7–0.89** — execute with toast
- **0.5–0.69** — confirm before executing
- **<0.5** — reject

## Naming trap — read this

`api/cartesia-stt.ts` and `api/cartesia-tts.ts` *sound* like they belong to Path 1 (the Cartesia Line agent). They don't. They're plain REST endpoints owned by **Path 2**. The legacy Line agent does its own STT and TTS internally over its WebSocket — it never hits `/api/cartesia-stt` or `/api/cartesia-tts`.

If you're tracing a request to those endpoints, you're in Path 2.

(After the Vapi migration, these endpoints may be renamed — but the trap is worth flagging in the meantime.)

## When you're editing Path 2 code

- **MP3 generation** → asset pipeline + Supabase Storage; `voice-manifest.json` lookup; `useVoicePlayer`.
- **STT changes** → `api/cartesia-stt.ts` + `src/lib/services/stt-service.ts`.
- **TTS changes** → `api/cartesia-tts.ts` + `src/lib/services/tts-service.ts`.
- **Intent / response logic (target)** → `callLLM()` + `screen_contexts` row for the surface.
- **Intent / response logic (today)** → `api/process-command.ts` + `src/lib/prompts/voice-command-system.ts`.
- **CRUD writes** → `src/lib/services/action-dispatcher.ts` + `src/lib/config/dispatcher-config.ts`.
- **Confidence tiers** → `src/lib/config/voice.ts` + dispatcher consumers.
- **Surface wiring** → the hook for that surface (see [surfaces.md](surfaces.md)).
