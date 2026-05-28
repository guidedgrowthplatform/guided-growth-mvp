# Path 3 Surfaces — Where Direct LLM Runs

The three non-Vapi orb states (UX-26 States 2, 3, 4) wherever they appear. Some are live today; many are pending callLLM landing.

## Chat surfaces (Path 3)

| Surface | Orb state | Today | Target |
|---|---|---|---|
| Onboarding chat overlay — typed branch | State 4 (text only) | Mixed wiring (text submit goes ad-hoc) | callLLM (channel discriminator planned, not implemented today) |
| Onboarding chat overlay — TTS-out / type-in branch | State 2 (voice_out_only) | TTS via `tts-service.ts` for system lines; text input from user | callLLM for response generation; TTS via `tts-service.ts` for playback |
| Onboarding chat overlay — STT-in / text-out branch | State 3 (voice_in_only) | Soniox async via `/api/stt`; LLM reply rendered as text only | callLLM after STT transcript ready. **Note**: State 3 is non-functional today pending Soniox realtime STT wiring |
| Post-onboarding CHAT screen | Defaults State 2, can flip to 3 or 4 via orb | Mixed wiring | Same callLLM path as onboarding overlay |
| Tap-driven LLM consumers (suggestions, summaries, parse-on-submit) | n/a (no orb interaction) | Ad-hoc | callLLM with synthesized prompt |
| Background jobs (insights, summaries, nightly digests) | n/a (server-side) | Not built | callLLM server-side |

## Taps that DON'T call the LLM (write session_log instead)

These taps generate `session_log` events; the LLM picks them up on the next callLLM.

| Action | event_type | Payload (illustrative) |
|---|---|---|
| Accept generated habit suggestion | `habit_added` | `{ habit_name, frequency }` |
| Change a preference | `prefs_changed` | `{ field, old, new }` |
| Navigate between screens | `navigate` | `{ from, to }` |
| Submit a form | `form_submit` | `{ form, fields }` |

The `session_log` write API is `POST /api/session_log` (P1-32, not built yet). Once built, every meaningful tap writes here.

## What's NOT a Path 3 surface

| Surface | Path | Why |
|---|---|---|
| Onboarding step pages in full duplex voice (State 1) | Path 1 | Vapi handles STT + LLM + TTS in one realtime session |
| Morning / evening check-ins | path-2-async | Async voice loop |
| Home voice check-in | path-2-async | Single-utterance voice command |
| Journal voice input | path-2-async | Mic-only, transcript-only |
| Feedback voice note | path-2-async | Mic-only, transcript-only |
| Pure CRUD without LLM (e.g. tap "complete habit") | None | Just write directly via DataService — no path required. (Still write session_log for awareness.) |

## File map (target — when callLLM lands)

| Layer | File (target) |
|---|---|
| LLM endpoint | `api/llm.ts` (target — not built) |
| Session log write endpoint | `api/session_log.ts` (target — P1-32, not built) |
| Browser hook for chat surfaces | `useLLM` (target — P1-38) or `useScreenContext` + `useLLM` composition (P1-41) |
| Browser hook for session_log writes | `useSessionLog` or inline writes from action handlers |

## Hook ownership (target)

- `useLLM` — Path 3 LLM calls. Owns: callLLM invocation, response state.
- `useScreenContext` — fetches the current screen's context block.
- `useSessionLog` — exposes `log(eventType, payload)` for tap handlers to call.

These hooks don't exist yet. Today's text/STT surfaces either ad-hoc-call OpenAI directly (anti-pattern) or route through the legacy async-path NLU when they could have been Path 3.

## Decision: typed branch of OnboardingChatOverlay

The overlay supports both typed input and voice. Full duplex voice is Path 1 (target). Typed input is **Path 3** — typed messages call callLLM without opening Vapi. Cheaper for users who prefer typing, and avoids burning Vapi session-minutes on typed conversations.
