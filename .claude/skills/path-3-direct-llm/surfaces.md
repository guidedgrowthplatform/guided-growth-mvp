# Path 3 Surfaces — Where the Direct-LLM Implementation Runs

The three non-Vapi orb states (UX-26 States 2, 3, 4) wherever they appear. Some are live today; many are pending callLLM landing.

> **Cost tier reminder.** State 2 (one-way TTS) and State 3 (mic-in / text-out) are cost-tier **Path 2** (one voice half on); only State 4 (text only) is cost-tier **Path 3**. They all share the Direct-LLM implementation documented here. The "Path" column below is the cost tier.

## Chat surfaces (Direct-LLM implementation)

| Surface | Orb state | Cost tier | Wiring |
|---|---|---|---|
| Onboarding chat overlay — typed branch | State 4 (text only) | Path 3 | `useLLM` → `/api/llm`. Onboarding tools on `ONBOARD-*` screens (see SKILL.md). |
| Onboarding chat overlay — TTS-out / type-in branch | State 2 (voice_out_only) | Path 2 | `useLLM` → `/api/llm`; assistant text spoken via Cartesia `tts-service.ts` |
| Onboarding chat overlay — STT-in / text-out branch | State 3 (voice_in_only) | Path 2 | Soniox via `/api/stt` → `useLLM`. State 3 STT realtime wiring is the remaining gap. |
| Post-onboarding CHAT screen | Defaults State 2, can flip to 3 or 4 via orb | Path 2 (State 4 → Path 3) | Same `useLLM` path. Base tools, no onboarding tools. |
| Tap-driven LLM consumers (suggestions, summaries, parse-on-submit) | n/a (no orb interaction) | Path 3 | Ad-hoc — should consolidate on `useLLM`. |
| Background jobs (insights, summaries, nightly digests) | n/a (server-side) | Path 3 | Not built |

## Onboarding tool-driven screens

These eight surfaces are the LLM-driven onboarding flow. The LLM calls a `submit_*`/`add_habit`/`remove_habit` tool; the handler UPSERTs `onboarding_states`; `useOnboardingRealtimeSync` (mounted on `OnboardingLayout`) writes the cache when Supabase Realtime fires; the overlay also merges `tool_result.result.data` into the cache as a local-only fallback so the form fills even without Realtime; `handleNext` page-level validation gates the advance.

Realtime delivery requires migration `038_onboarding_states_realtime.sql` (REPLICA IDENTITY FULL + add to `supabase_realtime` publication). Pending apply; the local cache merge in the overlay covers the gap.

| Screen | Tool |
|---|---|
| `ONBOARD-01--FORM` | `submit_profile` |
| `ONBOARD-FORK--FORM` | `submit_path_choice` |
| `ONBOARD-BEGINNER-01` | `submit_category` |
| `ONBOARD-BEGINNER-02` | `submit_goals` |
| `ONBOARD-BEGINNER-03` | `add_habit` / `remove_habit` |
| `ONBOARD-BEGINNER-07` | `submit_reflection_config` |
| `ONBOARD-ADVANCED` | `submit_brain_dump` |

The overlay also merges `tool_result.result.data` into the cache as a Realtime fallback. The adapter `src/lib/onboarding/toolEventToVoiceActions.ts` translates each tool event into the existing `OnboardingVoiceResult` shape so page-level `onVoiceAction` handlers stay unchanged.

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
