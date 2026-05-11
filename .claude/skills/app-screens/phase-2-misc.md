# Screens — Phase 2 — Misc

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 1 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `(merged into ONBOARD-BEGINNER-09)` | Check-in Reminders Setup | LLM-active | Vapi | Planned | Phase 2 |

## Screens

### `(merged into ONBOARD-BEGINNER-09)` — Check-in Reminders Setup

**Name:** Check-in Reminders Setup · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/reminders · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Phase 2 · **UX Rules:** UX-02, UX-09, UX-13 · **PostHog:** grant_notification_permission, update_checkin_schedule, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, settings_changed, llm_call

**Screen text (Figma):**

"When would you like to do your quick check-ins?"
Morning: 07:00 AM
Night: 10:30 PM
Button: "Save Reminders"

**AI Context Block:**

SCREEN: Check-in Reminders Setup
STATE: User setting morning + evening check-in times.
BEHAVIOR: 'When do you want to check in? I recommend about 15 minutes after waking and 15 before bed.' Parse times from voice. If nonsensical times, clarify.
DO NOT: Force reminders. Nag about them later.

**Voice Content:**

Live LLM via Cartesia Sonic:
'When do you want to check in with me? I recommend about 15 minutes after you wake up and 15 before bed. What times work?'

**Voice Instructions:**

[LLM-driven reminder setup]

**Voice Notes:**

LLM via callLLM(). Push notification scheduling backend.

**Expected user response:**

FULL: '7 AM and 10:30 PM'
PARTIAL: '7 AM' (missing evening) / 'Before bed' (vague)

**AI Response:**

FULL: 'Set - [morning] and [evening]. I'll be here.'
MISSING: 'Got it - [morning]. And what time for the evening?'
'Before bed': 'What time is bedtime for you?'

**System Action:**

1. Parse times
2. Save to user_profile
3. Schedule push notifications
4. Navigate to Home
5. Log PostHog: save_reminders

**Edge Cases:**

Nonsensical times: 'Evening check-in at 6 AM? Or did you mean 6 PM?'
No reminders wanted: 'No problem. Check-ins whenever you open the app.'

**Notes:**

'I'll be here' - a promise.

---

_Last refreshed: 2026-05-11_