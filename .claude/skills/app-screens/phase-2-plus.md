# Screens — Phase 2+ — beyond Phase 2

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 2 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `ONBOARD-ADVANCED` | Advanced Onboarding - Voice Goals (post-MVP) | LLM-active | Vapi | Planned | Post-MVP |
| `ONBOARD-ADVANCED-02` | Advanced Onboarding - AI Plan Review (post-MVP) | LLM-active | Vapi | Planned | Post-MVP |

## Screens

### `ONBOARD-ADVANCED` — Advanced Onboarding - Voice Goals (post-MVP)

**Name:** Advanced Onboarding - Voice Goals (post-MVP) · **Phase:** Phase 2+ · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/advanced/01 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Post-MVP · **UX Rules:** UX-02, UX-03, UX-09, UX-14 · **PostHog:** submit_voice_goals, llm_call · **session_log:** voice_started, voice_ended, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1355-6295 · **Figma node:** 1355:6295

**Screen text (Figma):**

Skip
Tell me what you want
to achieve
You can say or type as much as you want.
We'll organize it for you.
Try: "I would like to read for 15 mins every
night at 8 PM"
✨
Or type your thoughts here...

Examples: I want to sleep earlier, stop 
eating junk food at night, work out three 
times a week, and not be on my phone at 9.30 PM
Continue

**AI Context Block:**

SCREEN: Advanced Onboarding - Voice Goals (post-MVP)
STATE: User chose advanced path at ONBOARD-FORK. Has experience with habits already.
BEHAVIOR: Vapi agent asks user to bring their habits over one at a time. Captures name, time, frequency, reminder via voice or tap.
NEXT: All habits captured -> ONBOARD-ADVANCED-02 (AI plan review).
NOTE: Currently planned for post-MVP. May be activated earlier if needed.

**Voice Content:**

Live LLM via Vapi:
'Just read them to me one by one. Tell me the name, how often, what time, and if you want a reminder. We'll get your whole system set up.'

**Voice Instructions:**

[Vapi agent, advanced onboarding path]

**Voice Notes:**

Vapi agent, post-MVP advanced onboarding.

**Expected user response:**

Voice: '[habit name], [frequency], [time], [reminder yes/no]'

**AI Response:**

Confirmation per habit: '[habit] at [time], [frequency], [reminder status]. Got it. Anything else?'

**System Action:**

1. Vapi agent loop per habit
2. Save each to Supabase habits
3. Continue until user says 'done' or 'that's all'
4. Navigate to ONBOARD-ADVANCED-02

**Edge Cases:**

User has many habits: don't rush, take them one at a time.

**Notes:**

Post-MVP feature. Advanced path for users with existing habit list.

---

### `ONBOARD-ADVANCED-02` — Advanced Onboarding - AI Plan Review (post-MVP)

**Name:** Advanced Onboarding - AI Plan Review (post-MVP) · **Phase:** Phase 2+ · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/advanced/02 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Post-MVP · **UX Rules:** UX-02, UX-03, UX-09, UX-14 · **PostHog:** view_ai_organized_plan, tap_regenerate_plan, llm_call · **session_log:** navigate, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1355-6097

**Screen text (Figma):**

AI-generated habit plan displayed
Button: 'Looks good - continue'
Button: 'Regenerate plan'
Button: 'Edit individual habit'

**AI Context Block:**

SCREEN: Advanced Onboarding - AI Plan Review (post-MVP)
STATE: User completed advanced habit capture. AI now reviews and may suggest tweaks.
BEHAVIOR: Vapi agent reviews captured habits, may suggest small adjustments. User confirms or edits.
NEXT: Confirmed -> ONBOARD-BEGINNER-07 (reflection setup).

**Voice Content:**

Live LLM via Vapi:
'Here's what I've got from you. [Lists habits]. Anything you want to change before we set up the rest of your system?'

**Voice Instructions:**

[Vapi agent reviews and confirms]

**Voice Notes:**

Vapi agent, post-MVP review screen.

**Expected user response:**

Voice: 'Looks good' / 'Change [X]' / 'Add [Y]'

**AI Response:**

Confirmed: 'OK, locked in. Now let's set up your evening reflection.'
Edit: 'What do you want to change?'

**System Action:**

1. List captured habits via Vapi
2. Allow voice/tap edits
3. On confirm: navigate to ONBOARD-BEGINNER-07

**Edge Cases:**

User wants to add more after review: 'Sure, what else?'

**Notes:**

Post-MVP. Pairs with ONBOARD-ADVANCED-01.

---

_Last refreshed: 2026-05-11_