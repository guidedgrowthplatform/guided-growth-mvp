# Path 2 — Composition Patterns

Path 2 is a construction kit. Different surfaces use different subsets of the same pieces. This file lists the four shapes, when to use each, and which files implement them.

## The four shapes

```
A — One-way broadcast (no mic)
─────────────────────────────────────
[MP3 from Storage] OR [Sonic REST] → playback → User
Use for: SPLASH-01, PREF-01, MIC-01, POST-AUTH-01, affirmation playback


B — Transcript-only (no LLM, no TTS)
─────────────────────────────────────
User → mic → Cartesia Ink (STT) → transcript → drop into form
Use for: edit-habit / add-habit voice input (advanced flow), onboarding-layout shared mic — anywhere `useVoiceInput` is wired without an NLU step


C — Single-utterance command
─────────────────────────────────────
User → mic → Cartesia Ink → callLLM → ActionDispatcher → DataService → Supabase
                                   ↘ optional Sonic API → playback (talk-back)
Use for: home check-in single utterance ("create a habit called meditation"),
         any surface with tap-to-speak that maps speech → one CRUD action


D — Full async loop (prompt + reply + response)
─────────────────────────────────────
User → MP3 prompt (or Sonic REST) → playback
     → user speaks reply
     → Cartesia Ink (STT)
     → callLLM
     → LLM
     → Sonic API (TTS)
     → playback → User
Use for: morning check-in, evening check-in
```

Pick by what the surface needs. **Don't use a heavier shape than required** — every piece costs latency or money.

## Decision tree

```
1. Does the surface need to play audio that the user hears?
   NO  → no Path 2 audio. The surface might be Path 2 (app-code, text-only) or no AI at all.
   YES → continue.

2. Does the user need to speak a reply?
   NO  → Shape A (one-way broadcast).
   YES → continue.

3. Does the system need to do anything with the reply?
   "Just save the words to a form"            → Shape B (transcript-only).
   "Parse it and execute one CRUD action"     → Shape C (single-utterance command).
   "Reply with new dynamic audio"             → Shape D (full async loop).
```

## File map per piece

| Piece | File | Notes |
|---|---|---|
| MP3 lookup + playback | `useVoicePlayer` (target hook) + `voice-manifest.json` (target manifest in Supabase Storage) | Plays pre-generated MP3 by key. Falls back to Sonic REST if asset missing. |
| Sonic REST (live TTS) | `api/cartesia-tts.ts` (today) | POSTs `https://api.cartesia.ai/tts/bytes` with text + voice_id + model_id (`sonic-3`). Returns audio bytes. |
| TTS playback | `src/lib/services/tts-service.ts` | Browser-side scheduling; consumed by ~17 UI components beyond Path 2 (toasts, check-in cards, feedback button). Audit when touching. |
| Mic capture + Ink STT | `src/lib/services/stt-service.ts` + `api/stt.ts` | `getUserMedia` → PCM upload → Ink REST → transcript. |
| Intent parse (target) | `callLLM()` + `screen_contexts` ctx for the surface | Returns same `{ action, entity, params, confidence }` shape as today's NLU, plus optional spoken reply text. |
| Intent parse (today) | `api/process-command.ts` + `src/lib/prompts/voice-command-system.ts` | GPT-4o-mini, temperature 0.1, `response_format: json_object`. 21 few-shot examples + 17 parse rules. |
| CRUD execution | `src/lib/services/action-dispatcher.ts` + `src/lib/config/dispatcher-config.ts` | Maps intent → DataService method. |
| DataService | `src/lib/services/supabase-data-service.ts` (or `mock-data-service.ts`) | Behind `data-service.interface.ts`. |
| Confidence tiers | `src/lib/config/voice.ts` | 0.9 silent / 0.7 toast / 0.5 confirm / <0.5 reject. |
| Local fallback | `src/hooks/useVoiceCommand.ts:localParse()` | Regex-based fallback when `/api/process-command` is unreachable. Decision pending whether to keep under callLLM. |

## How surfaces compose

| Surface | Hook | Shape | Components |
|---|---|---|---|
| Home voice check-in | `useVoiceChat` → `useVoiceCommand` + `useVoiceInput` | C | `VoiceCheckInOverlay` |
| Edit habit voice (advanced) | `useVoiceInput` | B | `EditHabitPage`, `useAdvancedPath` |
| Onboarding layout shared mic | `useVoiceInput` | B | `OnboardingLayout` |
| Onboarding chat overlay (today's voice mode) | `useOnboardingVoice` + `useVoiceInput` | C | `OnboardingChatOverlay` *(but this is a Path-1 surface — see [path-1-vapi/surfaces.md](../path-1-vapi/surfaces.md))* |
| Morning check-in *(target)* | TBD — likely a new `useCheckIn` hook | D | TBD |
| Evening check-in *(target)* | TBD | D | TBD |
| SPLASH-01 *(target)* | `useVoicePlayer` (when MP3 generated); `tts-service` (live Sonic REST until then) | A | `SplashPage` |
| Affirmation | `tts-service` direct | A | various |

> The onboarding chat overlay sits awkwardly: today's code is Shape C (Path 2), but the **target** is Path 1 (Vapi assistant), because the surface is part of the coached onboarding journey. The migration moves it across paths.

## Latency and cost per shape

| Shape | First-byte latency | Per-interaction cost |
|---|---|---|
| A (MP3) | ~50ms | $0 (generated once) |
| A (Sonic REST) | ~250–400ms | per character |
| B | n/a (transcript appears in form) | per audio second STT |
| C | ~1s end-to-end (STT + LLM + dispatch) | STT + LLM tokens + (optional) TTS |
| D | ~1.5–2.5s round trip | MP3 (free) or Sonic + STT + LLM + Sonic |

Don't open Path 1 (Vapi) for any of these. Path 1 bills for the whole open session.

## What Path 2 does NOT do

- **Multi-turn conversation** — that's Path 1 (Vapi). If a check-in needs follow-up questions, escalate to Path 1.
- **Interruption handling** — Shape D doesn't support the user interrupting the LLM mid-reply. Each turn is a complete request/response.
- **Background tool calls during playback** — the LLM picks an action, the dispatcher runs it, then TTS plays. No streaming-tool-execution.

## Hybrid: cache Sonic output as MP3

When Sonic REST returns audio for fixed text (the same prompt across all users), cache the bytes keyed by text hash and reuse on subsequent loads. Gets near-MP3 latency with Sonic-REST flexibility. Practical for SPLASH-01 and similar fixed prompts that haven't been pre-generated.

## SPLASH-01 case

Today's SPLASH-01 plays **live Sonic REST** in the cloned voice (per client override on the v6 spec). When the pre-recorded MP3 lands, it switches to Shape A (MP3). Either way, **not Path 1** — a one-way 8-second broadcast doesn't justify Vapi session-minutes or Vapi handshake latency.
