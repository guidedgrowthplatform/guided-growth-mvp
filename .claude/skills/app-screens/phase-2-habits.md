# Screens — Phase 2 — Habit creation / edit / detail / list

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 11 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `HABIT-CREATE-FORK` | Add Habit | LLM-active | AsyncReflection | Planned | Phase 2 |
| `HABIT-CREATE-TEMPLATE-01` | Create Habit (Template) - Categories | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-CREATE-TEMPLATE-02` | Create Habit (Template) - Sub-categories | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-CREATE-TEMPLATE-03` | Create Habit (Template) - Habit Selection | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-CREATE-TEMPLATE-04` | Create Habit (Template) - Configure Time / Frequency | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-CREATE-TEMPLATE-05` | Create Habit (Template) - Review | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-CREATE-TEMPLATE-06` | Create Habit (Template) - Reflection Setup | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-CREATE-TEMPLATE-07` | Create Habit (Template) - Plan Summary | LLM-active | Vapi | Yes | Stage 4 |
| `HABIT-DETAIL` | Habit Detail / Streak | Hybrid | AsyncReflection | Planned | Phase 2 |
| `HABIT-EDIT` | Edit Habit | LLM-active | AsyncReflection | Planned | Phase 2 |
| `HABIT-LIST` | Habit List - Your Habits | Tap-only | None | Yes | Stage 4 |

## Screens

### `HABIT-CREATE-FORK` — Add Habit

**Name:** Add Habit · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen (not yet in Figma) · **Route:** /habit/add · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Phase 2 · **UX Rules:** UX-02, UX-03, UX-09 · **Tooltips:** TT-04 · **PostHog:** create_habit, llm_call · **session_log:** navigate, form_submit, habit_added, llm_call · **Figma node:** 2004:5307

**Screen text (Figma):**

Habit name input
WHEN? Time picker
HOW OFTEN? Day toggles
REMINDERS toggle
Button: "Save"

**AI Context Block:**

SCREEN: Add Habit
STATE: User adding a new habit (from + button or via voice).
BEHAVIOR: LLM-driven habit creation. Capture name, time, frequency, reminder. Same logic as ONBOARD-BEGINNER-04 but standalone.

**Voice Content:**

Live LLM via Cartesia Sonic (voice mode) or text:
'What habit would you like to add?'
Then once they give the name:
'Got it - [habit]. What time, how often, and want a reminder?'

**Voice Instructions:**

[Triggered by + button tap or voice 'add a habit']

**Voice Notes:**

LLM via callLLM(). Cartesia Sonic for voice, text for text mode.

**Expected user response:**

Habit name + time + frequency + optional reminder

**AI Response:**

'Done - [habit name], [frequency] at [time], [with/without] reminder.'

**System Action:**

1. Open new habit form
2. Capture name via voice or text
3. Parse frequency, time, reminder
4. Save to Supabase habits
5. Schedule push notification if reminder enabled
6. Log PostHog: add_habit

**Edge Cases:**

User vague: 'What would you like to call the habit?'
Reminder unclear: 'Do you want a reminder for this one?'

**Notes:**

Voice-first habit creation. Tap fallback always available.

---

### `HABIT-CREATE-TEMPLATE-01` — Create Habit (Template) - Categories

**Name:** Create Habit (Template) - Categories · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8075 · **Figma node:** 769:8075

**Screen text (Figma):**

Step 1 of 7
What feels most worth improving right now?
Pick one area to start. You can always add more
later.
Sleep Better
Move More
Eat Better
Feel more energized
Reduce stress
Improve focus
Break bad habits
Get more organized
Continue

**AI Context Block:**

SCREEN: Create Habit Template Step 1 — pick a category.
STATE: User in Add-Habit flow chose 'Templates' on HABIT-CREATE-FORK.
BEHAVIOR: Show 8 illustrated category cards (Sleep, Move, Eat, Energy, Stress, Focus, Break Bad Habits, Organize). User taps one. Vapi agent intro: 'Pick what you want to work on.'
NEXT: TEMPLATE-02 (sub-categories filtered to chosen category).

**Voice Content:**

What feels most worth improving right now?

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap a category card.

**AI Response:**

Brief acknowledgment of choice.

**System Action:**

1. Show 8 category cards
2. User picks one
3. Save category, navigate to TEMPLATE-02

**Edge Cases:**

User changes mind: back arrow returns to HABIT-CREATE-FORK.

**Notes:**

Same visual as ONBOARD-BEGINNER-01 (categories) but in single-habit context.

---

### `HABIT-CREATE-TEMPLATE-02` — Create Habit (Template) - Sub-categories

**Name:** Create Habit (Template) - Sub-categories · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8168 · **Figma node:** 769:8168

**Screen text (Figma):**

Step 2 of 7
Let's narrow it down
Choose your specific goals to help you sleep better
Category:
Sleep Better
Fall asleep earlier
Wake up earlier
Sleep more consistently
Sleep more deeply
Continue

**AI Context Block:**

SCREEN: Create Habit Template Step 2 — pick a sub-category.
STATE: User picked a category at TEMPLATE-01.
BEHAVIOR: Show sub-categories filtered to the chosen category (e.g., Sleep → 'Fall asleep earlier', 'Wake up earlier', etc.). Tap one to advance.
NEXT: TEMPLATE-03 (habit selection from list).

**Voice Content:**

Let's narrow it down. Pick a focus.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap a sub-category card.

**AI Response:**

Brief acknowledgment.

**System Action:**

1. Show sub-categories for picked category
2. User picks one
3. Save subcategory, navigate to TEMPLATE-03
4. Trigger SUB-* coaching response if defined

**Edge Cases:**

User changes mind: back arrow returns to TEMPLATE-01.

**Notes:**

Same visual as ONBOARD-BEGINNER-02 (sub-categories) but in single-habit context.

---

### `HABIT-CREATE-TEMPLATE-03` — Create Habit (Template) - Habit Selection

**Name:** Create Habit (Template) - Habit Selection · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8218 · **Figma node:** 769:8218

**Screen text (Figma):**

Step 3 of 7
Here's a good place to start
Select your daily habits to build your foundation.
Fall Sleep Earlier
Habit List
No screens after 10 PM
No caffeine after 2 PM
Start wind-down by 10 PM
Be in bed by target bedtime
No snooze
No food after 9 PM
Create your own habit!
Continue

**AI Context Block:**

SCREEN: Create Habit Template Step 3 — pick a habit from the curated list.
STATE: User picked a sub-category at TEMPLATE-02.
BEHAVIOR: Show 'Here's a good place to start' with a list of preset habits matching the sub-category (e.g., 'No screens after 10 PM', 'No caffeine after 2 PM', 'Start wind-down by 10 PM'). User picks ONE habit. Optional 'Create your own habit!' link at bottom.
NEXT: TEMPLATE-04 (configure time/frequency for the chosen habit).

**Voice Content:**

Here's a good place to start. Pick a habit.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap a habit row, or 'Create your own habit'.

**AI Response:**

Confirm choice and advance.

**System Action:**

1. Display preset habit list filtered by sub-category
2. User picks one
3. Save habit name
4. Navigate to TEMPLATE-04

**Edge Cases:**

Custom habit picked: prompt for habit name (text input or voice), then continue to TEMPLATE-04.

**Notes:**

Same visual as ONBOARD-BEGINNER-03 (habit selection) but for ONE habit only.

---

### `HABIT-CREATE-TEMPLATE-04` — Create Habit (Template) - Configure Time / Frequency

**Name:** Create Habit (Template) - Configure Time / Frequency · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8273 · **Figma node:** 769:8273

**Screen text (Figma):**

Step 4 of 7
What specifically do you
want to improve?
No Screens after 10 PM
Customize your habit
Choose one option.
When?
No screens after 10 PM
:
PM
Fall asleep earlier
How often?
S
M
T
W
T
F
S
Start wind-down by 10 PM
Reminder
Wake up earlier
Sleep more consistently
Sleep more deeply
Continue

**AI Context Block:**

SCREEN: Create Habit Template Step 4 — configure when, how often, reminder for the picked habit.
STATE: User picked a habit at TEMPLATE-03.
BEHAVIOR: Bottom-sheet style modal: WHEN (time picker, default sensible based on habit type), HOW OFTEN (day toggles SMTWTFS), REMINDER toggle. Continue advances; X dismisses.
NEXT: TEMPLATE-05 (review).

**Voice Content:**

When do you want to do this, and how often?

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Voice ('every day at 10pm with a reminder') or tap to configure.

**AI Response:**

Confirms config and advances.

**System Action:**

1. Display time picker + day toggles + reminder switch
2. User configures or accepts defaults
3. Save habit_config
4. Navigate to TEMPLATE-05

**Edge Cases:**

Vague voice ('be productive'): ask for specifics. 'Before bed': ask for specific time.

**Notes:**

Same visual as ONBOARD-BEGINNER-04 (habit configuration). Step indicator 'Step 4 of 7' is intentional — each new habit IS a 7-step flow.

---

### `HABIT-CREATE-TEMPLATE-05` — Create Habit (Template) - Review

**Name:** Create Habit (Template) - Review · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8701 · **Figma node:** 769:8701

**Screen text (Figma):**

Step 5 of 7
Here's a good place to start
No Screens after 10 PM
Schedule:
Edit
S
M
T
W
T
F
S
Start wind-down by 10 PM
Schedule:
Edit
S
M
T
W
T
F
S
Tooltip!
You can use the edit function to change the results of the habits you want to have!
Continue

**AI Context Block:**

SCREEN: Create Habit Template Step 5 — review the habit before saving.
STATE: User configured the habit at TEMPLATE-04.
BEHAVIOR: Show review of the new habit (name, schedule, reminder). Edit icons let user jump back to TEMPLATE-04 to adjust. Continue advances.
NEXT: TEMPLATE-06 (reflection setup if not yet configured) or TEMPLATE-07 (plan summary).

**Voice Content:**

Here's how it looks. Continue or tap edit to adjust.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap edit to revise, or Continue to advance.

**AI Response:**

Brief acknowledgment.

**System Action:**

1. Display habit review
2. User confirms or edits
3. Save final config
4. Navigate to TEMPLATE-06 or TEMPLATE-07

**Edge Cases:**

User dismisses: keep config and exit to HABIT-LIST.

**Notes:**

Same visual as ONBOARD-BEGINNER-06 (review) but for ONE habit.

---

### `HABIT-CREATE-TEMPLATE-06` — Create Habit (Template) - Reflection Setup

**Name:** Create Habit (Template) - Reflection Setup · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8547 · **Figma node:** 769:8547

**Screen text (Figma):**

Step 6 of 7
One last thing for your
mind
We highly recommend adding a quick daily
reflection to track your mental progress.
Daily reflection
Evening mindfulness
You'll answer 3 quick questions:
What am I proud of today?
What do I forgive myself for today?
What am I grateful for today?
Schedule:
Weekday
When?
:
PM
How often?
S
M
T
W
T
F
S
Reminder
Continue
You can change these settings later in your profile.

**AI Context Block:**

SCREEN: Create Habit Template Step 6 — optional reflection setup if user hasn't yet configured journaling.
STATE: User reviewed habit at TEMPLATE-05.
BEHAVIOR: Skip this screen if user already has reflection_style set. Otherwise, prompt to configure daily reflection (3 prompts, schedule).
NEXT: TEMPLATE-07 (final plan).

**Voice Content:**

One last thing — set up your daily reflection.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap to configure reflection or Skip.

**AI Response:**

Confirm setup.

**System Action:**

1. Check user_profile.reflection_style
2. If unset: show config UI; on save, navigate to TEMPLATE-07
3. If already set: skip directly to TEMPLATE-07

**Edge Cases:**

User skips reflection setup: continue to TEMPLATE-07; reflection can be set later in Settings.

**Notes:**

Same visual as ONBOARD-BEGINNER-07 (journal setup). Often skipped in single-habit context if user already has reflection configured.

---

### `HABIT-CREATE-TEMPLATE-07` — Create Habit (Template) - Plan Summary

**Name:** Create Habit (Template) - Plan Summary · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/create/template · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-8648 · **Figma node:** 769:8648

**Screen text (Figma):**

Step 7 of 7
Your starting plan
Start with these habits. You can always add
more later.
Habit
No screens after 10 PM
Cadence: Weekdays • Rule: Yes if no
recreational screen use after 10 PM
Habit
Start wind-down by 10 PM
Cadence: Daily • Rule: Yes if wind-
down routine started by 10 PM
Journal
Daily reflection
Cadence: Daily • Rule: Answer 3 quick
prompts
Start plan
Edit plan

**AI Context Block:**

SCREEN: Create Habit Template Step 7 — final summary, save the new habit.
STATE: User completed all habit configuration steps.
BEHAVIOR: Show summary card of the newly created habit. 'Start plan' or 'Done' button saves the habit and returns to HABIT-LIST.
NEXT: HABIT-LIST (with the new habit visible in the list).

**Voice Content:**

Your habit is ready. Tap to start.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap Start plan / Done.

**AI Response:**

Brief celebratory close.

**System Action:**

1. Display new habit summary
2. User taps Start plan
3. Save habit to Supabase habits table
4. Navigate to HABIT-LIST

**Edge Cases:**

User dismisses: habit still saved (config completed at TEMPLATE-04 already).

**Notes:**

Same visual as ONBOARD-BEGINNER-10 (plan summary) but for ONE habit.

---

### `HABIT-DETAIL` — Habit Detail / Streak

**Name:** Habit Detail / Streak · **Phase:** Phase 2 · **Active:** Planned · **Type:** Hybrid · **Row Type:** Screen · **Route:** /habit/:id · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Phase 2 · **UX Rules:** UX-01, UX-02, UX-09, UX-13 · **Tooltips:** TT-09 · **PostHog:** view_habit_detail, start_voice_session, llm_call · **session_log:** navigate, voice_started, voice_ended, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=769-2503 · **Figma node:** 769:2503

**Screen text (Figma):**

Morning Mindfulness
I will take morning mindfulness every morning so
that I can become a better person.
This shows your planned frequency and the specific time set for this habit
S
M
T
W
T
F
S
4x / week at 06:20 AM
Streak
Your journey at a glance. Blue checkmarks are wins, red crosses are missed days, and grey circles represent your scheduled off-days
March
Total Repetitions: 12 — Since March 1
S
M
T
W
T
F
S
W1
W2
W3
W4
W5
This is shown details analytical data from your habit activities
Completion Rate
Current Streak
85%
12 Days
Longest Streak
Failed Days
14 Days
2 Days
How do you feel about your progress towards
forming the "Morning Mindfulness" habit?
Log Habit Reflection
Tap to log, or just tell me you did it
Milestones
3 days streak
7 days streak
10 days streak
15 days streak
3 Milestones Earned
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Habit Detail View
STATE: User viewing a specific habit's stats, streaks, milestones.
BEHAVIOR: Voice on milestones only (3, 7, 14, 30, 60, 90, 100, 365 days). Milestones escalate emotionally. 365 is almost silent - the number speaks. On mic tap: 'Want to talk about [habit name]?' Broken streak (7+): 'Your streak reset. But [X] days doesn't disappear because of one day.'
DO NOT: Auto-play voice unless milestone. Guilt on broken streaks.

**Voice Content:**

MILESTONE MP3s (Yair voice, Phase 2):
3 days: 'Building momentum.'
7 days: 'One week, [Name]. Seven days straight. That's not luck - that's you.'
14 days: 'Two weeks. The resistance is fading.'
30 days: 'Thirty days. This started as something you were trying. Now it's something you do.'
60 days: 'Two months. This is just what you do now.'
90 days: '90 days. This habit is part of who you are.'
100 days: 'Triple digits. One hundred days of showing up.'
365 days: 'One year. I don't even need to say anything. You know what this means.'

LLM via Cartesia Sonic API on demand:
'Want to talk about [habit name]?'

**Voice Instructions:**

[Voice on milestones only - not on every screen load]
[On mic tap: LLM generates context-aware response via Cartesia Sonic]

**Voice Notes:**

Milestone MP3s at streak milestones. LLM via Cartesia Sonic on mic tap.

**Expected user response:**

Tap: Log Reflection / Edit / Share
Mic: 'How am I doing?' / 'Tell me about my streak'

**AI Response:**

'How am I doing': 'You're at [X]% completion with a [Y]-day streak. Your longest was [Z] days.'

BROKEN STREAK (7+): 'Your streak reset. But [X] days doesn't disappear because of one day. Start again.'
BROKEN (30+): 'That streak was real. One missed day doesn't erase what you built.'

**System Action:**

1. Fetch habit data from Supabase
2. Check milestone triggers
3. Play milestone MP3 if triggered, set shown = true
4. On mic tap: LLM via callLLM() -> Cartesia Sonic API
5. Log PostHog: view_habit_detail

**Edge Cases:**

Milestones escalate emotionally. 365 is almost silent - the number speaks.

**Notes:**

Milestones: 3, 7, 14, 30, 60, 90, 100, 365 days. 8 milestone MP3s in Phase 2.

---

### `HABIT-EDIT` — Edit Habit

**Name:** Edit Habit · **Phase:** Phase 2 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habit/:id/edit · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Phase 2 · **UX Rules:** UX-02, UX-03, UX-09, UX-13 · **PostHog:** edit_habit, llm_call · **session_log:** navigate, form_submit, habit_edited, llm_call · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1355-8983 · **Figma node:** 1355:8983

**Screen text (Figma):**

Edit Habit
Habit Name
Sleep by 11 PM
When?
:
PM
Schedule:
Weekday
How Often?
S
M
T
W
T
F
S
Edit with Voice
Just say what you want to change, like
"Change schedule to weekends only"
Continue

**AI Context Block:**

SCREEN: Edit Habit
STATE: User editing an existing habit.
BEHAVIOR: 'What do you want to change?' Parse changes one at a time. Confirm each change. Update UI + Supabase.
DO NOT: Require voice. Make editing feel difficult.

**Voice Content:**

Live LLM via Cartesia Sonic (voice mode) or text:
'What do you want to change about this habit?'
'Updated [change]. All good?'
'Reminders turned off. You can always turn them back on in Settings or here.'

**Voice Instructions:**

[Plays on voice edit tap or mic tap from edit screen]

**Voice Notes:**

Voice edit. LLM parses change. Real-time response.

**Expected user response:**

'Change the time to 10 PM'
'Make it weekdays only'
'Change the name to [new name]'
'Turn off reminders'
'Turn on reminders at [time]'

**AI Response:**

'Updated [change]. All good?'

**System Action:**

1. Parse change: {field, new_value}
2. Update UI + Supabase
3. Update/cancel push notifications if reminder changed
4. Log PostHog: edit_habit {fields_changed, input_method}

**Edge Cases:**

Multiple changes: handle one at a time. 'Change time to 10 and make it weekdays': 'Updated to 10 PM, weekdays only. Anything else?'

**Notes:**

'Edit with Voice' card teaches voice-first behavior.

---

### `HABIT-LIST` — Habit List - Your Habits

**Name:** Habit List - Your Habits · **Phase:** Phase 2 · **Active:** Yes · **Type:** Tap-only · **Row Type:** Screen · **Route:** /habits · **Voice Engine:** None · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1552-5651 · **Figma node:** 1552:5651

**Screen text (Figma):**

Your Habits
Scroll through your thoughts and milestones.
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
Afternoon Walk
10,000 steps
Add New Habit
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Habit List (Your Habits)
STATE: User browsing all configured habits.
BEHAVIOR: Display list of all active habits with daily progress bar (X of Y completed). Tap a habit row → HABIT-DETAIL. Tap '+ Add New Habit' → HABIT-CREATE-FORK.
DO NOT: Auto-play voice. Show inactive/archived habits without filter.

**Voice Content:**

(no audio - tap-only screen)

**Voice Instructions:**

[silent]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap habit row, '+ Add New Habit', or back arrow.

**AI Response:**

(no AI response on this screen)

**System Action:**

1. Load user habits
2. Display with completion stats
3. Route to HABIT-DETAIL on row tap
4. Route to HABIT-CREATE-FORK on +Add

**Edge Cases:**

No habits yet (new user before onboarding completes): show empty state with onboarding prompt.

**Notes:**

Reachable from HOME-DEFAULT 'See all' card.

---

_Last refreshed: 2026-05-11_