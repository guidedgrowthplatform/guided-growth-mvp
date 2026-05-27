# Path 2 Surfaces — Component → Hook → Composition Map

Every Path 2 surface, with the hook chain and which composition shape (A/B/C/D from [composition.md](composition.md)) it uses.

## Today (live code)

| UI component | File | Hook chain | Shape | Notes |
|---|---|---|---|---|
| Home voice check-in | `src/components/home/VoiceCheckInOverlay.tsx` | `Layout.tsx` mounts overlay → `useVoiceChat` → `useVoiceCommand` + `useVoiceInput` | C | Single-utterance command. Uses GPT-4o-mini NLU. |
| Onboarding chat overlay | `src/components/onboarding/OnboardingChatOverlay.tsx` | `useOnboardingVoice` + `useVoiceInput` | C | **Lives here today, but target is Path 1 (Vapi)** — see [path-1-vapi/surfaces.md](../path-1-vapi/surfaces.md). |
| Edit habit (advanced) | `src/pages/onboarding/advanced/EditHabitPage.tsx` | `useVoiceInput` | B | Transcript-only. |
| Add habit (advanced flow) | `src/pages/add-habit/useAdvancedPath.ts` | `useVoiceInput` | B | Transcript-only. |
| Onboarding layout shared mic | `src/components/onboarding/OnboardingLayout.tsx` | `useVoiceInput` | B | Transcript-only. |
| Affirmation playback | various | `tts-service` direct | A (Sonic REST) | Dynamic text, one-way. |

> **Stale claims removed (May 2026):** the journal `FreeformTab.tsx` (`src/components/journal/FreeformTab.tsx`) and the feedback sheet (`src/components/home/FeedbackSheet.tsx`) do **not** wire any voice today — checked in code, neither imports `useVoice*` or `stt-service`. The legacy `voice-commands` skill listed them as Path-2 surfaces; that was aspirational or out-of-date. If voice gets added to either, document the wiring here.

## Target (when migration completes)

| UI component | File (target) | Hook chain (target) | Shape | Source of prompt |
|---|---|---|---|---|
| Morning check-in | TBD (`src/components/checkin/MorningCheckIn.tsx` or similar) | `useCheckIn('morning')` (target) | D | Pre-recorded MP3 from Storage |
| Evening check-in | TBD (`src/components/checkin/EveningCheckIn.tsx` or similar) | `useCheckIn('evening')` (target) | D | Pre-recorded MP3 from Storage |
| Home voice check-in | `VoiceCheckInOverlay.tsx` | rewritten to call `callLLM()` instead of `/api/process-command` | C | No prompt — user-initiated tap-to-speak |
| SPLASH-01 | `SplashPage.tsx` | `useVoicePlayer('splash_hook')` when MP3 exists; `tts-service` (Sonic REST) until then | A | Pre-recorded MP3 (target) / live Sonic (today) |
| PREF-01 | similar | similar | A | same |
| MIC-01 | similar | similar | A | same |
| POST-AUTH-01 | similar | similar | A | same |
| Affirmation | various | `tts-service` direct | A (Sonic REST) | dynamic |

## Key files

| Layer | File |
|---|---|
| STT REST handler | `api/stt.ts` |
| TTS REST handler | `api/cartesia-tts.ts` |
| NLU REST handler (legacy) | `api/process-command.ts` |
| NLU prompt (legacy) | `src/lib/prompts/voice-command-system.ts` |
| Browser STT | `src/lib/services/stt-service.ts` |
| Browser TTS | `src/lib/services/tts-service.ts` |
| Intent → CRUD | `src/lib/services/action-dispatcher.ts` |
| Dispatcher rules | `src/lib/config/dispatcher-config.ts` |
| Voice tunables | `src/lib/config/voice.ts` |
| Local parser | `src/hooks/useVoiceCommand.ts:localParse()` |

## Hook ownership

- `useVoiceCommand` — Path 2, single-utterance commands. Owns: STT call, NLU call (or local parser), dispatcher invocation.
- `useVoiceInput` — Path 2, transcript-only mode. Owns: STT call, transcript callback. No NLU, no dispatcher.
- `useVoiceChat` — Path 2, composes `useVoiceCommand` + `useVoiceInput` for the home check-in overlay.
- `useOnboardingVoice` — **today** Path 2, **target** Path 1. Used by `OnboardingChatOverlay`. Will rewrite against Vapi Web SDK.
- `useVoicePlayer` — Path 2, MP3 playback (Shape A). Owns: voice-manifest lookup, audio scheduling.

## Shared with Path 1

These primitives are consumed by both paths. Editing any of them affects both surfaces — audit both before changing behavior.

| Primitive | Owner | Path 1 use | Path 2 use |
|---|---|---|---|
| `tts-service.ts` | shared | (consumes Vapi-emitted audio in target; legacy Cartesia Line did its own) | Shape A + D TTS playback |
| `VoiceContext` + `useVoice` | shared | mutex when Vapi session is active | mutex when Path 2 mic is hot |
| `voiceSettingsStore` | shared | reads recording mode, voice preference | same |
| `voiceStore` | shared | listening / transcript / interim state | same |

## Per-surface gotchas

- **Home voice check-in**: today's flow assumes single-action-only. Multi-intent ("create habit X and metric Y") is intentionally not supported. Don't add multi-intent without a product decision.
- **Edit habit / add habit (advanced)**: `useVoiceInput` drops a transcript into the field — no auto-submit. User reviews and taps save.
- **Onboarding chat overlay**: today routes through Path 2 hooks but is a Path 1 surface. When migrating, rewire to Vapi — don't add Path 2 features that the overlay would lose on migration.
- **SPLASH-01**: 8-second hook. Audio MUST stop on auth-button tap and on unmount. Don't open Path 1 here (burns Vapi minutes for a one-way broadcast).

## Confidence calibration is a Path 2 contract

When the LLM replies through `callLLM()`, it returns a `confidence` score along with the action. Path 2 surfaces that auto-execute (Shape C) check it:

- 0.9+ → execute silently
- 0.7–0.89 → execute and show toast
- 0.5–0.69 → show confirmation modal before executing
- <0.5 → reject and show "didn't understand" message

These tiers live in `src/lib/config/voice.ts` and apply to every Shape C surface. Don't bypass.
