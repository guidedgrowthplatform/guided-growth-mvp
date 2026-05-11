# Path 3 Surfaces — Where Direct LLM Runs

Text-only and tap-driven LLM use cases. Some are live today; many are pending callLLM landing.

## Text chat surfaces

| Surface | Today | Target |
|---|---|---|
| In-app chat (post-onboarding) | TBD — may not exist as a distinct surface yet | callLLM with `channel: 'direct'`, screen_contexts ctx for the chat screen |
| Onboarding chat overlay (typed branch) | Mixed wiring (text submit goes ad-hoc) | Decision pending — typed branch may stay Path 3 inside the otherwise-Path-1 overlay (see [path-1-vapi/surfaces.md](../path-1-vapi/surfaces.md)) |

## Tap-driven LLM consumers

| Surface / action | Today | Target | Trigger |
|---|---|---|---|
| "Suggest a new habit" | Local logic / ad-hoc OpenAI call (varies) | callLLM with synthesized prompt | User tap |
| "Give me a weekly summary" | Today: Tier-3 voice command (Path 2) handles "give me a weekly summary" | Same intent reachable via tap → callLLM | Tap or voice |
| Daily insights / nightly summary | Not built | Background job → callLLM (server-side) | Cron / scheduled |
| Habit reflection prompt | Not built | callLLM after a streak milestone | Trigger on milestone write |

## Tap actions that DON'T call the LLM (write session_log instead)

These taps generate `session_log` events; the LLM picks them up on the next callLLM (anywhere in the app).

| Action | event_type | Payload (illustrative) |
|---|---|---|
| Add habit | `habit_added` | `{ habit_name, frequency }` |
| Mark habit complete | `habit_completed` | `{ habit_id, date }` |
| Delete habit | `habit_deleted` | `{ habit_id }` |
| Log goal | `goal_logged` | `{ goal_text, date }` |
| Update preferences | `prefs_changed` | `{ field, old, new }` |
| Navigate screen | `navigate` | `{ from, to }` |
| Submit form | `form_submit` | `{ form, fields }` |

The `session_log` write API is `POST /api/session_log` (P1-32, not built yet). Once built, every meaningful tap writes here.

## Background jobs

Server-side cron / scheduled work that calls `callLLM()` without a user in the loop.

| Job | Cadence | What it does |
|---|---|---|
| Nightly insights | TBD | Reads `session_log` for the day → callLLM with summary prompt → writes back to `insights` table |
| Weekly digest | TBD | Aggregates the week → callLLM → notification or in-app surface |
| Habit suggestion refresh | TBD | Per-user → callLLM with their context → updates suggested-habits list |

None of these are wired today.

## What's NOT a Path 3 surface

| Surface | Path | Why |
|---|---|---|
| Onboarding step pages (ONBOARD-01..09) | Path 1 | Realtime coached voice |
| Morning / evening check-ins | Path 2 | Async voice loop |
| Home voice check-in | Path 2 | Single-utterance voice command |
| Journal voice input | Path 2 | Mic-only, transcript-only |
| Feedback voice note | Path 2 | Mic-only, transcript-only |
| Pure CRUD without LLM (e.g. tap "complete habit") | None | Just write directly via DataService — no path required. (Still write session_log for awareness.) |

## File map (target — when callLLM lands)

| Layer | File (target) |
|---|---|
| LLM endpoint | `api/llm.ts` (target — not built) |
| Session log write endpoint | `api/session_log.ts` (target — P1-32, not built) |
| Browser hook for chat surfaces | `useLLM` (target — P1-38) or `useScreenContext` + `useLLM` composition (P1-41) |
| Browser hook for session_log writes | `useSessionLog` or inline writes from action handlers |

## Hook ownership (target)

- `useLLM` — Path 3 chat surfaces and tap-driven LLM calls. Owns: callLLM invocation, response state.
- `useScreenContext` — fetches the current screen's context block (for surfaces that want to render or peek at the prompt).
- `useSessionLog` — exposes `log(eventType, payload)` for tap handlers to call.

These hooks don't exist yet. Today's text surfaces either ad-hoc-call OpenAI directly (anti-pattern) or route through the legacy Path 2 NLU when they could have been Path 3.

## Decision: typed branch of OnboardingChatOverlay

The overlay supports both typed input and voice. Voice is Path 1 (target). Typed input could be:

- **Path 3** — typed messages call `callLLM('direct')` without opening Vapi. Cheaper for users who prefer typing.
- **Path 1** — typed messages also go through Vapi (which can accept text input alongside audio). One channel to maintain.

Recommend Path 3 for the typed branch — Vapi session-minutes for a typed conversation are wasteful — but confirm when the overlay migration is in flight.
