# Screens — Phase 2 — Home extended screens + CHAT + VOICE-CAP

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 7 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `CHAT` | Free-Form Voice Conversation | LLM-active | AsyncReflection | Planned | Stage 5 |
| `HOME-EVENING` | Home Evening | Hybrid | None | Planned | Stage 5 |
| `HOME-FIRST` | Home First Visit | LLM-active | Vapi | Planned | Stage 5 |
| `HOME-MORNING` | Home Morning | Hybrid | None | Planned | Stage 5 |
| `HOME-MORNING-CHECKIN-EXPANDED` | Home - Morning Check-in Expanded | LLM-active | Vapi | Yes | Stage 4 |
| `HOME-RETURN` | Home Return After 3+ Days | LLM-active | Vapi | Planned | Stage 5 |
| `VOICE-CAP` | Voice Cap Reached | MP3-only | MP3 | Planned | Stage 5 |

## Screens

### `CHAT` — Free-Form Voice Conversation

**Name:** Free-Form Voice Conversation · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /voice · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-06, UX-09, UX-12, UX-13, UX-22 · **PostHog:** start_voice_session, voice_ai_response, mental_health_safety_triggered, llm_call · **session_log:** voice_started, voice_ended, llm_call, intent_classified · **Tasks:** P2-32, P1-47 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1408-13501

**Screen text (Figma):**

[Listening animation]
[Transcription]
[AI response]
[Optional habit cards]

**AI Context Block:**

SCREEN: Voice Conversation (anytime, from any screen)
STATE: User tapped mic from anywhere. Open-ended conversation.
BEHAVIOR: 'What's on your mind?' Determine intent:
- Habit creation: 'What habit would you like to add?' -> collect name, time, freq, reminder.
- Habit edit: 'Done - [change made].'
- Coaching/stress: Acknowledge, don't fix. 'What's the main thing weighing on you?'
- Venting: 'I hear you.' Brief acknowledgment. Do NOT try to fix.
- Question about data: Answer from their data.
- Check-in request: Route to MCHECK-01 or ECHECK-01.
CONTEXT-AWARE: If from habit detail -> 'Want to talk about [habit]?' If from focus session -> 'Taking a break?' If from insights -> 'Questions about your data?'
MENTAL HEALTH BOUNDARY (UX-06): If user expresses self-harm, crisis: Stop coaching. Express care. Provide 988. Do NOT continue.
MULTI-TURN: Voice conversations can be back-and-forth within a session. Maintain context.
CAP: 5 open-ended conversations/day (UX-12). Check-ins don't count. Silent cap.
DO NOT: Give speeches (4 sentences max). Assume intent. Fix venting.

**Voice Content:**

Opening: 'What's on your mind?'

[See ai_response for intent-based responses]

**Voice Instructions:**

[On mic tap from any screen]
[Uses callLLM() with screen context. Voice path uses Cartesia Sonic API for TTS, text path uses direct LLM]

**Voice Notes:**

Free-form conversation. LLM via callLLM(). Voice mode = Cartesia Sonic API live TTS. Text mode = direct LLM.

**Expected user response:**

HABIT CREATION: 'I want to start meditating' / 'Add a new habit' / 'I want to add another habit'
HABIT EDIT: 'Change my gym time to mornings'
COACHING: 'I've been stressed' / 'I'm not motivated'
QUESTION: 'How many habits have I completed this week?'
VENTING: 'Today was awful' / long emotional share
CHECK-IN: 'Let me do my check-in'
GENERAL: 'What can you do?' / 'Help'

**AI Response:**

HABIT (with name): '[habit] - great idea. Let me set that up. What time, how often, and want a reminder?'
HABIT (no name): 'Sure - what habit would you like to add?' Then once they give the name: 'Got it - [habit]. What time, how often, and want a reminder?'
EDIT: 'Done - [change made].'
STRESS: 'That sounds heavy. What's the main thing weighing on you?'
VENTING: 'I hear you. [Brief acknowledgment - do NOT try to fix].'
QUESTION: '[Answer from data].'
HELP / WHAT CAN YOU DO: 'I can help you add or change habits, talk through how your day's going, answer questions about your progress, or just listen. What do you need?'

**System Action:**

1. Capture voice via Soniox STT
2. Send to LLM via callLLM() with context (habits, recent check-ins, goals, coaching style, anon_id only per UX-20)
3. LLM determines intent
4. Route by intent: habit CRUD, coaching, data query, general
5. Stream response to Cartesia Sonic API (voice mode) or display text (text mode)
6. Increment daily_voice_count
7. If count >= 5: see VOICE-CAP
8. Log PostHog: voice_conversation {intent, duration, actions_taken}

**Edge Cases:**

CHECK-INS DO NOT COUNT toward voice conversation cap.
CONTEXT-AWARE: If mic tapped from habit detail screen, AI knows which habit: 'Want to talk about [habit name]?'
From focus session: 'Taking a break from your focus session?'
From insights: 'Questions about your data?'
MENTAL HEALTH BOUNDARY (UX-06 + GC-15): If user says something concerning (self-harm, crisis): Stop coaching, provide 988, do not continue.

**Notes:**

Context changes based on which screen mic was tapped from. Cap is silent - no counter shown.

---

### `HOME-EVENING` — Home Evening

**Name:** Home Evening · **Phase:** Phase 2 · **Active:** Planned · **Type:** Hybrid · **Row Type:** Screen · **Route:** /home · **Voice Engine:** None · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-09, UX-22 · **PostHog:** view_home, start_voice_session, start_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, mic_tapped, llm_call · **Tasks:** P2-33 · **Figma node:** 769:1540

**Screen text (Figma):**

Tuesday, March 3, 2026
Good Morning, Jeff
Skip Tutorial
Show me
Tap here to add a habit you want to build.
Quick tour? (Skip / Show me)
Thu
Wed
Fri
Sat
Sun
Mon
Tue
Wed
Thu
Fri
How are you feeling?
Daily Reflection
Check In
Open Journal
Start your day here. Morning check-in covers mood, sleep, energy, and stress.
Reflect at the end of your day. Voice or text - whichever you prefer.
Track today's wins. This bar shows how many habits you've completed so far."
Today's Habits
See all
These are your habits. Tap any one to see details, or just tell me what you did.
Daily Progress
3 of 5 habits completed
60%
Morning Mindfulness
1 session
Daily Hydration
8 glasses
Deep Reading Novel...
30 mins
Afternoon Walk
10,000 steps
Recent Reflections
See all
Today, 08:30 PM
Today was surprisingly productive. I managed to
finish the core logic of the habit tracker and even…
Yesterday, 10:15 PM
The evening walk really helped clear my mind. I
need to remember to do this more often,…
Tap to switch between me talking to you or writing to you
Tap here to see the conversation
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Home (evening, before check-in)
STATE: Evening. User may have completed some/all habits.
BEHAVIOR: No auto-play. If mic tapped and evening check-in not done, route to ECHECK-01. If already done, route to voice conversation. Evening tone is warmer, reflective.
DO NOT: Auto-play. Guilt about incomplete habits.

**Voice Content:**

No auto-play voice.

On mic tap: silently route to ECHECK-01 (if check-in not done) or CHAT (if done).

If evening check-in already done and mic tapped: 'You've already wrapped up today. Anything on your mind?'

**Voice Instructions:**

[No auto-play. No greeting on this screen.]
[Mic tap routes to ECHECK-01 which handles the greeting via async reflection pattern.]
[If check-in already done: open voice conversation (CHAT) instead.]

**Voice Notes:**

No auto-play. User initiates.

**Expected user response:**

Same tap options as morning

**AI Response:**

If mic: route to evening check-in flow

**System Action:**

1. Show habit completion status (some may be checked off already)
2. Evening greeting
3. If evening check-in not done: evening reminder may trigger

**Edge Cases:**

If all habits already marked complete: Mic -> 'Looks like you've already logged everything. Anything else on your mind?'
User says 'add a habit' / 'another habit': AI: 'Sure - what habit would you like to add?' Same collection flow as ONBOARD-BEGINNER-04.

**Notes:**

Evening tone is warmer, reflective.

---

### `HOME-FIRST` — Home First Visit

**Name:** Home First Visit · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /home · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-03, UX-09, UX-19 · **Tooltips:** TT-01, TT-02, TT-03, TT-04, TT-05, TT-06, TT-07, TT-08 · **PostHog:** view_home, llm_call · **session_log:** navigate, voice_started, voice_ended, llm_call · **Tasks:** P2-33 · **Figma node:** 769:1540

**Screen text (Figma):**

Tuesday, March 3, 2026
Good Morning, Jeff
Skip Tutorial
Show me
Tap here to add a habit you want to build.
Quick tour? (Skip / Show me)
Thu
Wed
Fri
Sat
Sun
Mon
Tue
Wed
Thu
Fri
How are you feeling?
Daily Reflection
Check In
Open Journal
Start your day here. Morning check-in covers mood, sleep, energy, and stress.
Reflect at the end of your day. Voice or text - whichever you prefer.
Track today's wins. This bar shows how many habits you've completed so far."
Today's Habits
See all
These are your habits. Tap any one to see details, or just tell me what you did.
Daily Progress
3 of 5 habits completed
60%
Morning Mindfulness
1 session
Daily Hydration
8 glasses
Deep Reading Novel...
30 mins
Afternoon Walk
10,000 steps
Recent Reflections
See all
Today, 08:30 PM
Today was surprisingly productive. I managed to
finish the core logic of the habit tracker and even…
Yesterday, 10:15 PM
The evening walk really helped clear my mind. I
need to remember to do this more often,…
Tap to switch between me talking to you or writing to you
Tap here to see the conversation
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Home (first visit after onboarding)
STATE: User just completed onboarding. First time seeing Home.
BEHAVIOR: 5-second orientation pause when screen loads (per UX-19 - let user see the layout). Then sequential spotlight tour begins: TT-01 through TT-08 highlighted one at a time, user taps Next to advance, skippable at any point. After tour completes (or skip), user is in regular Home state. Tour shows once per account; replayable from Settings.
GOAL: Orient without overwhelming. One-time only.
NEXT: Tour complete -> regular Home behavior. User taps mic -> CHAT. User taps Check In -> MCHECK-01.

**Voice Content:**

[After 5-sec pause] Here's your home. This is where you'll check in every day. Want a quick tour of how this works? Tap any tooltip to skip ahead, or tap Skip Tour anytime.

**Voice Instructions:**

[First visit only - plays once. 5-second pause first, then sequential spotlight tour kicks in: TT-01 (Mic side of orb), TT-02 (AI side of orb), TT-03 (Open Chat), TT-04 (Add Habit +), TT-05 (Feedback button), TT-06 (Streak icon), TT-07 (Note icon), TT-08 (Complete icon). User taps Next between each. Skip button always visible.]
[Vapi agent welcomes the user, then tooltip system takes over for the tour]

**Voice Notes:**

Vapi agent welcome on first home visit. Uses name + time of day. Then tooltip spotlight tour TT-01 through TT-08.

**Expected user response:**

Tap Next to advance through tour, OR
Tap Skip Tour to exit tour, OR
Tap mic / Check In / habit to interrupt and go elsewhere

**AI Response:**

Tour completion: '[Name], that's the home screen. Your first check-in is ready when you are.'
Skip Tour: 'Got it. If you ever want a walkthrough, just ask. Your first morning check-in is ready whenever you are.'

**System Action:**

1. Detect: onboarding_completed_at within last 5 minutes (= first visit)
2. Pause 5 seconds (orientation)
3. Start sequential spotlight tour (TT-01 -> TT-08)
4. Set tour_completed = true on Skip or final Next
5. Render today's habits from Supabase
6. Calculate greeting by time of day
7. Log PostHog: first_home_visit {tour_completed, tour_skipped}

**Edge Cases:**

If user taps mic instead during tour: pause tour, route to CHAT
If user goes straight to a habit: skip tour, mark tour_completed

**Notes:**

Special one-time moment. Only plays once. Sequential spotlight tour is the key UX moment.

---

### `HOME-MORNING` — Home Morning

**Name:** Home Morning · **Phase:** Phase 2 · **Active:** Planned · **Type:** Hybrid · **Row Type:** Screen · **Route:** /home · **Voice Engine:** None · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-09, UX-22 · **PostHog:** view_home, start_voice_session, start_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, mic_tapped, llm_call · **Tasks:** P2-33 · **Figma node:** 769:1540

**Screen text (Figma):**

Tuesday, March 3, 2026
Good Morning, Jeff
Skip Tutorial
Show me
Tap here to add a habit you want to build.
Quick tour? (Skip / Show me)
Thu
Wed
Fri
Sat
Sun
Mon
Tue
Wed
Thu
Fri
How are you feeling?
Daily Reflection
Check In
Open Journal
Start your day here. Morning check-in covers mood, sleep, energy, and stress.
Reflect at the end of your day. Voice or text - whichever you prefer.
Track today's wins. This bar shows how many habits you've completed so far."
Today's Habits
See all
These are your habits. Tap any one to see details, or just tell me what you did.
Daily Progress
3 of 5 habits completed
60%
Morning Mindfulness
1 session
Daily Hydration
8 glasses
Deep Reading Novel...
30 mins
Afternoon Walk
10,000 steps
Recent Reflections
See all
Today, 08:30 PM
Today was surprisingly productive. I managed to
finish the core logic of the habit tracker and even…
Yesterday, 10:15 PM
The evening walk really helped clear my mind. I
need to remember to do this more often,…
Tap to switch between me talking to you or writing to you
Tap here to see the conversation
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Home (morning, before check-in)
STATE: Regular morning. User may or may not have done their check-in.
BEHAVIOR: No auto-play. If mic tapped and check-in not done, route to MCHECK-01. If check-in already done, route to voice conversation (CHAT).
AFTERNOON (12-5pm): Same as morning but greeting changes to 'Good afternoon.' If morning check-in not done, don't nag. If user taps mic: 'Want to do a quick check-in? We can still do it.' Not mandatory.
DO NOT: Auto-play voice. Nag about uncompleted check-in. Be loud.
CONTEXT-AWARE MIC: If user says 'add a habit', ask 'What habit would you like to add?'

**Voice Content:**

No auto-play voice.

On mic tap: silently route to MCHECK-01 (if check-in not done) or CHAT (if done).

If check-in already done and mic tapped: 'You've already checked in today. What's on your mind?'

**Voice Instructions:**

[No auto-play. No greeting on this screen.]
[Mic tap routes to MCHECK-01 which handles the greeting via async reflection pattern.]
[If check-in already done: open voice conversation (CHAT) instead.]

**Voice Notes:**

No auto-play. User initiates everything.

**Expected user response:**

Tap: Check In / Mic / Any habit / Journal / Give Feedback / Nav item

**AI Response:**

If mic: route to check-in or voice conversation
If Check In tapped: open check-in screen

**System Action:**

1. Greeting by time: before 12 = Morning, 12-17 = Afternoon, after 17 = Evening
2. Show today's habits by day of week
3. Show completion status

**Edge Cases:**

Check-in already done: mic -> voice conversation
Afternoon, check-in not done: no nagging
User says 'add a habit' / 'another habit': AI asks 'What habit would you like to add?' then collect name, time, frequency, reminder.

**Notes:**

Home is calm. No auto-play.

---

### `HOME-MORNING-CHECKIN-EXPANDED` — Home - Morning Check-in Expanded

**Name:** Home - Morning Check-in Expanded · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /home (state: checkin-expanded) · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-672 · **Figma node:** 769:672

**Screen text (Figma):**

Tuesday, March 3, 2026
Good Morning, Jeff
Thu
Wed
Fri
Sat
Sun
Mon
Tue
Wed
Thu
Fri
How are you feeling?
Sleep Quality
Poor
Fair
Good
Great
Deep!
Mood
Awful
Bad
Meh
Good
Awesome!
Energy Level
Drained
Low
Medium
Active
Charged
Stress Level
Extreme
High
Moderate
Light
Relaxed
Check In
Daily Reflection
Today's Habits
See all
Morning Mindfulness
1 session
Daily Hydration
8 glasses
Deep Reading Novel...
30 mins
Afternoon Walk
10,000 steps
Recent Reflections
See all
Today, 08:30 PM
Today was surprisingly productive. I managed to
finish the core logic of the habit tracker and even…
Yesterday, 10:15 PM
The evening walk really helped clear my mind. I
need to remember to do this more often,…
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Home with morning check-in card OPEN
STATE: User on HOME-MORNING tapped 'Check In' card. Now showing sleep/mood/energy/stress scales inline.
BEHAVIOR: Four scales (Sleep Quality, Mood, Energy Level, Stress Level) with visual options. Tap to select. 'Check In' button submits. Inherits MCHECK-01 spec — same data capture, just integrated into home instead of separate screen.
NEXT: HOME-DEFAULT (collapse back) after submit.

**Voice Content:**

Quick check in — how was your sleep, mood, energy, stress?

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap scale options. Tap 'Check In' to submit.

**AI Response:**

Brief acknowledgment after submit.

**System Action:**

1. Show 4 scale grids
2. User taps options
3. Tap submit → save check-in data → collapse to HOME-DEFAULT

**Edge Cases:**

User taps elsewhere: collapse without saving.

**Notes:**

Replaces standalone MCHECK-01 screen — now home-state variant. Timothy: button copy 'Check In' → 'Morning Check-in' (tracked in items list).

---

### `HOME-RETURN` — Home Return After 3+ Days

**Name:** Home Return After 3+ Days · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /home · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-09, UX-13 · **PostHog:** open_app, llm_call · **session_log:** navigate, voice_started, voice_ended, llm_call · **Tasks:** P2-33 · **Figma node:** 769:1540

**Screen text (Figma):**

Tuesday, March 3, 2026
Good Morning, Jeff
Skip Tutorial
Show me
Tap here to add a habit you want to build.
Quick tour? (Skip / Show me)
Thu
Wed
Fri
Sat
Sun
Mon
Tue
Wed
Thu
Fri
How are you feeling?
Daily Reflection
Check In
Open Journal
Start your day here. Morning check-in covers mood, sleep, energy, and stress.
Reflect at the end of your day. Voice or text - whichever you prefer.
Track today's wins. This bar shows how many habits you've completed so far."
Today's Habits
See all
These are your habits. Tap any one to see details, or just tell me what you did.
Daily Progress
3 of 5 habits completed
60%
Morning Mindfulness
1 session
Daily Hydration
8 glasses
Deep Reading Novel...
30 mins
Afternoon Walk
10,000 steps
Recent Reflections
See all
Today, 08:30 PM
Today was surprisingly productive. I managed to
finish the core logic of the habit tracker and even…
Yesterday, 10:15 PM
The evening walk really helped clear my mind. I
need to remember to do this more often,…
Tap to switch between me talking to you or writing to you
Tap here to see the conversation
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Home (returning after 3+ days)
STATE: User hasn't opened the app in 3+ days.
BEHAVIOR: Vapi agent auto-plays a short welcome back. 'No judgment - life happens.' If 7+ days: 'Everything's here just like you left it.'
DO NOT: Guilt. Ask why they were gone. Show stats about what they missed.

**Voice Content:**

Hey [Name]. It's been a few days. No judgment - life happens. Want to pick up where you left off?

**Voice Instructions:**

[Vapi agent auto-plays on first open after 3+ days of inactivity, live TTS]

**Voice Notes:**

Vapi agent return greeting after 3+ days. References days inactive.

**Expected user response:**

Voice: 'Yeah' / 'Let's go'
Silence/tap: User just starts using the app

**AI Response:**

If yes: 'Good to have you back. Your habits are right here. Let's start fresh today.'
If they just start tapping: no follow-up needed

**System Action:**

1. Check last_active_date
2. If gap >= 3 days: connect to Vapi and play return greeting
3. Reset any stale daily data
4. Set returning_user flag for PostHog
5. Log: user_return {days_inactive}

**Edge Cases:**

Don't guilt. Don't ask why they were gone. Just welcome back.
If gap is 7+ days: 'Hey [Name]. Welcome back. Everything's here just like you left it. Whenever you're ready.'

**Notes:**

No judgment. Life happens.

---

### `VOICE-CAP` — Voice Cap Reached

**Name:** Voice Cap Reached · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Screen (not yet in Figma) · **Route:** /voice/cap · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Stage 5 · **UX Rules:** UX-01, UX-04, UX-12 · **PostHog:** voice_cap_reached · **session_log:** navigate, voice_started, voice_ended, voice_cap_reached · **Tasks:** P2-30

**Screen text (Figma):**

[Normal mic animation then message]

**AI Context Block:**

SCREEN: Voice Cap Reached
STATE: User has used 5 voice conversations today (per UX-12).
BEHAVIOR: MP3 plays gentle message. 'You've used your voice sessions for today. I'll be here tomorrow. You can still do your check-ins and log habits on screen.'
WHAT COUNTS: Only open-ended conversations. Check-ins, focus, habit edits = free.
DO NOT: Show a counter. Make it feel punitive. Block check-ins.

**Voice Content:**

MP3 (Yair voice): 'You've used your voice sessions for today. I'll be here tomorrow. In the meantime, you can still do your check-ins and log habits on screen.'

**Voice Instructions:**

[MP3 plays once. No live agent.]

**Voice Notes:**

Pre-recorded MP3 in Yair's cloned voice. Plays when daily voice cap hit.

**Expected user response:**

User might try again: same message.
User might ask why: same message.

**AI Response:**

-

**System Action:**

1. Check daily_voice_count >= 5 (excluding check-ins)
2. Play voice_cap MP3 from Supabase Storage
3. Disable mic for conversations (keep for check-ins)
4. Reset at midnight user's timezone

**Edge Cases:**

Check-ins NEVER count. Focus start/end don't count. Habit edit via voice doesn't count. Only open-ended conversations count.

**Notes:**

Silent cap. No counter shown.

---

_Last refreshed: 2026-05-11_