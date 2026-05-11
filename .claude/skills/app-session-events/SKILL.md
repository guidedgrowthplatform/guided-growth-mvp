---
name: app-session-events
description: Use when writing or reading session_log events (navigate / voice_started / voice_ended / habit_added / habit_completed / checkin_started / checkin_completed / goal_set / reflection_logged / llm_call / etc.), understanding event payloads for state delta to LLM, picking past-tense event names, or wiring logEvent() in the frontend
user-invocable: false
---

# session_log Events

Source: Google Sheet **Guided Growth OS App Master** · tab `session_log Events` · gid `1240955040` · maintained by Yonas (backend).

25 backend event types that power the LLM **state delta**. **NEW in v6.0.** Distinct from PostHog (different consumer). Naming convention: **past-tense verbs** (`habit_added`, `habit_completed`) because `session_log` records what HAS happened. PostHog uses present-tense verbs.

## When to use
- Wiring `logEvent()` in a new frontend feature — pick from this list before inventing a new event.
- Adding a new event — add the row to the sheet first, then implement.
- Debugging "why doesn't the LLM know about X?" — the answer is usually a missing `logEvent` call.
- Modeling `state_delta` returned by `/api/context`.

## Distinct from PostHog

| Aspect | `session_log` | PostHog |
|---|---|---|
| Consumer | `callLLM()` state delta | Said / Yonas analytics dashboards |
| Naming | Past tense (`habit_added`) | Present tense (`create_habit`) |
| Keyed to | `anon_id` (per UX-20) | `distinct_id` (anon → user merge) |
| Storage | Supabase `session_log` table | PostHog |

Some user actions fire BOTH. They serve different consumers and have intentionally different names.

## Events

| Event Type | When Fired | Payload Schema | Screen(s) Fires From | Why It Matters for LLM | Status |
|---|---|---|---|---|---|
| `navigate` | User transitions between screens | `{ from_screen, to_screen, trigger: 'tap'\|'voice'\|'auto' }` | All screens | LLM knows where the user just came from. Without this, LLM can't say "how did the new water habit go?" after user added it 2 screens back. | Pending |
| `voice_started` | Cartesia voice session begins | `{ screen_id }` | All LLM-active voice screens | `callLLM()` needs to know if Cartesia is active to route LLM calls correctly. Sets `cartesiaSessionActive = true`. | Pending |
| `voice_ended` | Cartesia voice session closes | `{ screen_id, duration_sec, reason: 'user_exit'\|'silence_timeout'\|'navigate_away' }` | All LLM-active voice screens | Sets `cartesiaSessionActive = false`. **Critical for cost** — if not fired, Cartesia minutes burn after user leaves. | Pending |
| `mic_tapped` | User taps mic button | `{ from_screen }` | All screens with mic button | Tells LLM the user wants to talk — useful for context-aware response in CHAT. | Pending |
| `mic_permission_granted` | Browser mic prompt: granted | `{}` | MIC-PERMISSION | Updates user state. LLM knows voice channel is available. | Pending |
| `mic_permission_denied` | Browser mic prompt: denied/dismissed | `{}` | MIC-PERMISSION | Updates user state. LLM knows to fall back to text/tap, never expects voice input. | Pending |
| `form_submit` | User submits a form | `{ screen_id, fields: {...} }` | AUTH-SIGNUP, ONBOARD-01..09, SETTINGS, HABIT-CREATE-FORK, HABIT-EDIT | LLM knows what data the user just provided. Used to build prompt context. | Pending |
| `habit_added` | New habit created | `{ habit_id, name, time, frequency, has_reminder }` | ONBOARD-BEGINNER-03/06, HABIT-CREATE-FORK, CHAT | **Critical for cross-channel context.** LLM in voice check-in must know about habits added by tap. | Pending |
| `habit_edited` | Habit modified | `{ habit_id, fields_changed }` | HABIT-EDIT, CHAT | LLM knows about schedule/name changes. Can reference "I see you moved gym to mornings". | Pending |
| `habit_deleted` | Habit removed | `{ habit_id, name }` | HABIT-EDIT, CHAT | LLM stops asking about deleted habits. | Pending |
| `habit_completed` | Habit marked done | `{ habit_id, completed_at, via }` | HOME-*, ECHECK-02, ECHECK-03, FOCUS-TIMER | LLM uses for evening check-in summary and weekly insights. | Pending |
| `checkin_started` | Check-in flow opens | `{ type: 'morning'\|'evening' }` | MCHECK-01, ECHECK-01 | LLM knows user is in active check-in — influences response style. | Pending |
| `checkin_completed` | Check-in flow finishes | `{ type, sleep, mood, energy, stress, via }` | MCHECK-01 (M), ECHECK-06 (E) | Critical data point for LLM. Used in next conversation context. | Pending |
| `goal_set` | Morning goal recorded | `{ goal_text }` | MCHECK-02 | LLM remembers to ask about it in evening check-in (ECHECK-04). | Pending |
| `goal_outcome_logged` | Evening check on morning goal | `{ goal_text, outcome: 'achieved'\|'missed'\|'partial' }` | ECHECK-04 | Closes the morning-evening loop. Used in weekly insights. | Pending |
| `reflection_logged` | Daily reflection saved | `{ style, prompt, response_length }` | ECHECK-05 | LLM has reflection content for next day's context. Can reference "You mentioned yesterday you were proud of...". | Pending |
| `settings_changed` | Setting updated | `{ field, old_value, new_value }` | SETTINGS | LLM knows about preference changes — check-in time, reflection style, etc. | Pending |
| `focus_started` | Focus session begins | `{ habit_id, duration_min }` | FOCUS-TIMER | LLM knows user is in focus mode — influences voice conversation context. | Pending |
| `focus_ended` | Focus session ends | `{ habit_id, duration_min, status }` | FOCUS-TIMER | LLM has focus session data for context. | Pending |
| `intent_classified` | LLM determines voice intent | `{ intent, confidence }` | CHAT | Logged for analytics + future LLM context. "User often opens voice to vent." | Pending |
| `voice_cap_reached` | User hit 5 conversations/day | `{}` | VOICE-CAP | LLM knows to give the cap message instead of opening conversation. | Pending |
| `llm_call` | Any LLM call completes | `{ path, screen_id, prompt_tokens, response_tokens, latency_ms, delta_event_count }` | All LLM-active screens | Both for monitoring AND as the **timestamp source for the next call's state delta.** Critical: this is what "caught up" means — delta starts from last `llm_call`. | Pending |
| `onboarding_completed` | User finishes onboarding | `{ duration_sec, habit_count, reflection_style }` | ONBOARD-BEGINNER-10 | LLM knows user is fully set up — changes greeting on first home visit. | Pending |
| `voice_preference_set` | User picks voice or screen at VOICE-PREFERENCE | `{ preference: 'voice'\|'screen' }` | VOICE-PREFERENCE | LLM knows whether to default to TTS or text output for this user. | Pending |
| `user_returned` | User returns after 3+ days inactive | `{ days_inactive }` | HOME-RETURN | LLM knows to use returning-user greeting instead of regular morning greeting. | Pending |

## Maintainer's note

> Backend developer (Yonas). New in v6.0. `session_log` is the data source for state delta — the recent activity prepended to every LLM call. Distinct from PostHog (which is for product analytics). Both can fire on the same user action but they serve different consumers. Naming convention here: past-tense verbs (`habit_added`, `habit_completed`) because `session_log` records what HAS happened. PostHog uses present-tense verbs from the v5 doc (`complete_habit`, `create_habit`) — intentional naming difference between systems.

## Related

- `app-architecture` — state delta pipeline, `/api/context`, "caught up" principle.
- `app-llm-activation` — when each event class fires.
- `app-posthog-events` — analytics taxonomy (sibling system).
- `app-tasks` — `P1-32` (build `session_log` table + write API), `P1-40` (`logEvent()` helper).
- `UX-20` (anonymization) — events keyed to `anon_id`, never auth user_id.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="session_log Events"
)
```

Trigger: "refresh app-session-events" or "resync the sheet".

_Last refreshed: 2026-05-11_
