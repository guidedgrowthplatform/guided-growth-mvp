# Screens — Phase 2 — Focus, Insights, Settings

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 3 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `FOCUS-TIMER` | Focus Session | Hybrid | AsyncReflection | Planned | Phase 2 |
| `INSIGHTS-ANALYTICS` | Insights / Patterns | LLM-active | AsyncReflection | Planned | Phase 2 |
| `SETTINGS` | Settings | Hybrid | None | Planned | Phase 2 |

## Screens

### `FOCUS-TIMER` — Focus Session

**Name:** Focus Session · **Phase:** Phase 2 · **Active:** Planned · **Type:** Hybrid · **Row Type:** Screen · **Route:** /focus · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Phase 2 · **UX Rules:** UX-02, UX-09, UX-13 · **PostHog:** start_focus_session, complete_focus_session, abandon_focus_session, llm_call · **session_log:** navigate, focus_started, focus_ended, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-5361 · **Figma node:** 769:5361

**Screen text (Figma):**

Focus Session
Deep Reading Novel...
Choose your focus. Select the specific habit you're working on to link this session to your progress stats.
Your deep work clock. This shows your remaining time. Tap the pencil icon below to manually adjust the duration.
Start your flow. Tap to begin the countdown, or pause if you need a quick break
Tap mic to set time (e.g., "Focus for 30 minutes")
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Focus Session
STATE: User starting a timed focus session linked to a habit.
BEHAVIOR: Setup: 'What are you focusing on, and how long?' Start: '[X] minutes of [habit]. Go.' (one word = ritual). Complete: 'Time's up. How'd it go?' If mic during session: 'You're in a focus session with [X] minutes left. Want to end it, or keep going?'
DO NOT: Question short durations ('Just 5 minutes' = '5 minutes works. Go.'). Interrupt.

**Voice Content:**

Live LLM via Cartesia Sonic API:
Setup: 'What are you focusing on, and how long?'
Start: '[X] minutes of [habit]. Go.'
Complete: 'Time's up. [X] minutes of [habit] - done. How'd it go?'
Response (positive): '[Reflects what they said]. Logged.'
Response (distracted): 'Some focus is better than none. Still counts.'

**Voice Instructions:**

[LLM via Cartesia Sonic for setup, start, complete]

**Voice Notes:**

LLM via Cartesia Sonic for start/complete messages. References habit + duration.

**Expected user response:**

Setup: 'Reading for 25 minutes' / 'Meditation, 10 minutes'
Complete: 'Good' / 'Got through two chapters' / 'I got distracted'

**AI Response:**

Complete (positive): '[Reflects what they said]. Logged.'
Complete (distracted): 'Some focus is better than none. Still counts.'

**System Action:**

1. Parse: habit + duration from voice
2. Start timer, create focus_session record
3. On complete: auto-complete linked habit
4. Log PostHog: focus_session

**Edge Cases:**

No habit specified: 'Which habit?'
No time: 'How long?'
'Just 5 minutes': '5 minutes works. Go.'
MIC DURING SESSION: 'You're in a focus session with [X] minutes left. Want to end it, or keep going?'

**Notes:**

'Go.' - one word. Ritual.

---

### `INSIGHTS-ANALYTICS` — Insights / Patterns

**Name:** Insights / Patterns · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /insights · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Phase 2 · **UX Rules:** UX-02, UX-09, UX-11, UX-13, UX-20 · **Tooltips:** TT-10, TT-11, TT-12 · **PostHog:** view_insights, llm_call · **session_log:** navigate, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-4939 · **Figma node:** 769:4939

**Screen text (Figma):**

Insights
Overall Analytics
Check-in History
Switch your view. Choose 'Overall Analytics' for habit trends or 'Check-in History' to see your past daily logs
Week
Month
Year
Habit Completion
85%
Average Completion
+12% ↑
Daily breakdown. See exactly how your consistency fluctuated throughout the week. Higher bars mean more habits completed
MON
TUE
WED
THU
FRI
SAT
SUN
Habit Performance
Individual breakdown. View the specific completion rate and current streak for each of your active habits
Morning Mindfulness
80%
12 day streak
Daily Hydration
65%
5 day streak
Mood Correlation
High Correlation
Sleep
Energy
Stress
Mood
Smart insights. Our AI identifies patterns between your lifestyle factors and your daily well-being
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Insights (weekly/monthly)
STATE: User viewing their data patterns.
BEHAVIOR: Only narrate with 3+ data points showing a real pattern (per UX-11). Be specific and data-backed, not prescriptive. 'Your mood is consistently better on 7+ hour sleep nights. That's a real pattern.' Let user decide what to do. No data yet: 'After a week or two, I'll start showing you patterns.'
DO NOT: Speculate from 1-2 data points. Give generic encouragement. Be prescriptive.

**Voice Content:**

Live LLM via Cartesia Sonic API (only with 3+ data points):
Weekly: 'This week you completed [X]% of your habits.'
Monthly: '[Month] at a glance.'
On mic: 'Questions about your data?'

**Voice Instructions:**

[Optional narration - only with 3+ data points (UX-11)]
[On mic tap: LLM via Cartesia Sonic responds]

**Voice Notes:**

LLM via Cartesia Sonic on demand, only with 3+ data points.

**Expected user response:**

Mic: 'How did I do this week?' / 'What patterns do you see?' / 'Am I improving?'

**AI Response:**

Responds with data-backed analysis. See AI Coaching Framework for insight rules.

**System Action:**

1. Aggregate data for period (using anon_id per UX-20)
2. Run pattern detection (3+ data points)
3. If pattern: generate insight via callLLM()
4. Log PostHog: view_insights

**Edge Cases:**

No data yet: 'After a week or two, I'll start showing you patterns.'

**Notes:**

Insights tell a STORY. AI only speaks when valuable.

---

### `SETTINGS` — Settings

**Name:** Settings · **Phase:** Phase 2 · **Active:** Planned · **Type:** Hybrid · **Row Type:** Screen · **Route:** /settings · **Voice Engine:** None · **Stage:** Phase 2 · **UX Rules:** UX-02, UX-09, UX-14 · **PostHog:** view_settings, update_profile, llm_call · **session_log:** navigate, settings_changed, form_submit, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-5663 · **Figma node:** 769:5663

**Screen text (Figma):**

Settings
Jeff Doe
jeff.doe@example.com
Edit Profile
AI Assistant
AI Coaching Style
Friendly & Empathetic
Voice Model
Alex (Male - Calm)
Voice-to-Text Language
English (US)
Check-In Routine
Morning Check In
Night Check in
Push Notifications
Privacy & Account
Privacy Policy
Delete Account & Data
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Settings
STATE: User in settings. Purely configuration.
BEHAVIOR: No auto-voice. On mic tap: 'Want to change something? Just tell me.' MVP: Check-in times, push notifications, profile, privacy, delete account. POST-MVP: AI coaching style selector, voice model selector.
DO NOT: Auto-play anything. Make settings feel like a conversation.

**Voice Content:**

On mic tap (LLM via Cartesia Sonic): 'Want to change something in your settings? Just tell me.'
'Updated - [change]. You can always change it again here.'

**Voice Instructions:**

[No voice on screen load. Voice only plays on mic tap.]

**Voice Notes:**

No voice on settings load. LLM via Cartesia Sonic on mic tap.

**Expected user response:**

Mic: 'Change my morning check-in to 8 AM' / 'Turn off notifications'
Tap: Edit profile, change times, toggle notifications

**AI Response:**

'Updated - [change]. You can always change it again here.'

**System Action:**

1. On check-in time change: reschedule push notifications
2. On push toggle: enable/disable all
3. Delete Account: double confirm -> Supabase cascade delete -> sign out
[POST-MVP: coaching style reloads LLM prompt, voice model updates TTS voice_id]

**Edge Cases:**

Delete Account should have double confirmation: 'Are you sure? This removes all your data permanently. Type DELETE to confirm.'

**Notes:**

MVP: Single coaching style (Warm & Thoughtful), single voice (cloned). Voice model selection and coaching style selection are post-MVP features.

---

_Last refreshed: 2026-05-11_