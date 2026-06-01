# Screens — Phase 2 — Check-in & Reflection screens

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 14 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `ECHECK-01` | Evening Check-in Open | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `ECHECK-02` | Evening Self-Report | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `ECHECK-03` | Evening AI-Read | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `ECHECK-04` | Goal Check (if morning goal set) | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `ECHECK-05` | Daily Reflection | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `ECHECK-06` | Evening Wrap-up | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `EVENING-REFLECTION-ENTRY` | Journal - Entry Detail | Tap-only | None | Yes | Stage 4 |
| `EVENING-REFLECTION-FREEFORM` | Journal - Freeform | LLM-active | Vapi | Yes | Stage 4 |
| `EVENING-REFLECTION-GUIDED` | Journal - Guided Reflection | LLM-active | Vapi | Yes | Stage 4 |
| `HOME-DAILY-REFLECTION` | Home - Daily Reflection | LLM-active | Vapi | Yes | Stage 4 |
| `MCHECK-01` | Morning Check-in | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `MCHECK-02` | Morning Goal (Voice Only) | Async Reflection | AsyncReflection | Planned | Stage 5 |
| `RECENT-REFLECTIONS` | Recent Reflections (List) | Tap-only | None | Yes | Stage 4 |
| `REFLECTION-LOG` | Habit Reflection Log | LLM-active | Vapi | Yes | Stage 4 |

## Screens

### `ECHECK-01` — Evening Check-in Open

**Name:** Evening Check-in Open · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Legacy / Older Plan · **Route:** /checkin/evening · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-01, UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** start_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, checkin_started, llm_call · **Tasks:** P2-29, P2-30, P2-34

**Screen text (Figma):**

[Uses Home screen with habit completion status]

**AI Context Block:**

SCREEN: Evening Check-in (opening, async reflection pattern)
STATE: Evening. User's habits for today are loaded. Morning goal may exist.
BEHAVIOR: MP3 prompt asks 'Let's wrap up your day. Would you like to go through your habits yourself, or want me to read them off?' Two methods: self-report (ECHECK-02) or AI-read (ECHECK-03). Both valid. If user just taps without voice, let them - summarize at end (ECHECK-06).
FLOW: Habits -> Goal check (if exists) -> Reflection (mandatory) -> Wrap-up.
DO NOT: Force voice. Skip straight to reflection. Use Vapi.

**Voice Content:**

Prompt MP3 (Yair voice): 'Hey [Name] - let's wrap up your day. Would you like to go through your habits yourself, or want me to read them off?'

Live LLM response (Cartesia Sonic):
SELF-REPORT: 'Go ahead - tell me how today went.'
AI-READ: 'OK. Let's go through them. [First habit] - did you do it?'

**Voice Instructions:**

[Async reflection pattern, triggered by evening reminder]
[MP3 prompt -> user choice -> LLM-driven flow]

**Voice Notes:**

Async reflection. MP3 prompt + LLM-driven response routing.

**Expected user response:**

SELF-REPORT: 'I'll do it' / 'I'll report' / 'Let me tell you'
AI-READ: 'Read them' / 'You go' / 'Go through them'
JUST TAPPING: User taps complete/skip without voice

**AI Response:**

SELF-REPORT: 'Go ahead - tell me how today went.'
AI-READ: 'OK. Let's go through them. [First habit] - did you do it?'

**System Action:**

1. Fetch today's habits from Supabase
2. Fetch morning goal if exists
3. Play prompt MP3
4. Determine method via voice or tap
5. Navigate to ECHECK-02 (self-report) or ECHECK-03 (AI-read)
6. Log PostHog: evening_checkin_method

**Edge Cases:**

Just tapping without voice: let them. Voice summarizes at end (ECHECK-06).
User says something else: 'Want to go through your habits first, or is something on your mind?'
Evening wrap-up (ECHECK-06) plays regardless of method.

**Notes:**

User chooses method. Both equally valid.

---

### `ECHECK-02` — Evening Self-Report

**Name:** Evening Self-Report · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Legacy / Older Plan · **Route:** /checkin/evening/self · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** complete_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, habit_completed, llm_call · **Tasks:** P2-29, P2-34

**Screen text (Figma):**

[Habit list with complete/skip/miss buttons]

**AI Context Block:**

SCREEN: Evening Self-Report
STATE: User chose to report their own habits.
BEHAVIOR: 'Go ahead - tell me how today went.' Parse habit names to completion status. Handle synonyms (gym=workout=exercise). If unclear, ask for specifics. 'All of them' = mark all complete. 'Most of them' = ask which specifically.
DO NOT: Judge. Ask why they missed something. Extend the moment.

**Voice Content:**

Live LLM response (Cartesia Sonic API):
CLEAR: 'Got it - [summary]. [Positive comment if warranted].'
PARTIAL: 'OK - which ones specifically?'
GOOD DAY: 'Let me mark those. [Confirm list]'
NOT GREAT: 'That's OK. Which ones did you get to?'
ALL DONE: 'All [X] habits done? Nice. Let me mark them all complete.'

**Voice Instructions:**

[Async reflection. User voice -> LLM parses -> Cartesia Sonic response]

**Voice Notes:**

Async reflection. LLM parses voice, responds via Cartesia Sonic API live TTS.

**Expected user response:**

FULL: 'Did mindfulness, hydration, skipped reading, went for a walk.'
PARTIAL: 'I did most of them' / 'Only got two done'
BY NAME: 'I did gym and meditation but skipped everything else'
SHORT: 'Good day' / 'Not great'
ALL DONE: 'I did everything' / 'All of them'

**AI Response:**

[See AI Voice column for response variations]

**System Action:**

1. Open Soniox STT
2. Parse voice: match habit names to status
3. Update Supabase habit_completions
4. After all accounted for: transition to ECHECK-04 (if goal exists) or ECHECK-05 (reflection)
5. LLM responses via callLLM() -> Cartesia Sonic API
6. Log PostHog: evening_habit_report {method: 'self_report', completed, skipped, missed}

**Edge Cases:**

Can't match name: 'I'm not sure which habit you mean. Can you say the full name?'
Habit not on today's list: '[Habit] isn't scheduled for today. Want to log it anyway?'
User emotional about missing: 'Tomorrow's a fresh start. Let's keep going.'

**Notes:**

NLP must handle synonyms: gym=workout=exercise, reading=read=book, etc.

---

### `ECHECK-03` — Evening AI-Read

**Name:** Evening AI-Read · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Legacy / Older Plan · **Route:** /checkin/evening/airead · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** complete_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, habit_completed, llm_call · **Tasks:** P2-29, P2-34

**Screen text (Figma):**

[Same screen]

**AI Context Block:**

SCREEN: Evening AI-Read (coach reads habit list)
STATE: User chose AI-read method.
BEHAVIOR: Go through habits one by one via Cartesia Sonic API. Vary phrasing: 'Did you do it?' / 'How about [habit]?' / 'Last one - [habit]?' Responses per habit: Completed = 'Nice.' / Skipped = 'OK.' / Sort of = 'I'll mark that done. Every bit counts.' If user gives all at once ('did 1, 2, 4, skipped 3'), accept it - don't force one-by-one.
DO NOT: Be robotic. Guilt on skips. Extend responses beyond one word per habit.

**Voice Content:**

Live LLM via Cartesia Sonic, dynamic per habit:

'OK. Let's go through them.
[Habit 1 name] - did you do it?'
[After response, Habit 2:]
'How about [habit name]?'
[After response, Habit 3:]
'And [habit name]?'
[Last habit:]
'Last one - [habit name]?'

[After all:]
'That's all of them. [Summary].'

**Voice Instructions:**

[Dynamic - LLM iterates through user's active habits, each segment via Cartesia Sonic]
[Vary phrasing per habit to avoid robotic repetition]

**Voice Notes:**

Async reflection. LLM iterates per habit, each response via Cartesia Sonic API.

**Expected user response:**

PER HABIT: 'Yes' / 'Yeah' / 'Did it' / 'Checked'
'No' / 'Skipped it' / 'Didn't get to it'
'Sort of' / 'Half' / 'Started but didn't finish'

**AI Response:**

COMPLETED: 'Nice.' or 'Got it.' [move to next]
SKIPPED: 'OK.' [move to next - no guilt]
SORT OF: 'I'll mark that as done. Every bit counts.'
[After last habit:] 'That's all of them. [Summary].'
[Beat/pause before goal check or reflection]

**System Action:**

1. Iterate through today's habits one by one
2. LLM generates phrasing variation, sent to Cartesia Sonic
3. Open Soniox STT, wait for response after each
4. Save status per response
5. After all: summarize and transition to ECHECK-04 (if goal) or ECHECK-05 (reflection)

**Edge Cases:**

User interrupts: 'Actually I did [habit 3] too' mid-list AI: 'Got it - marking that done. OK, next - [continue list]'
User wants to speed up: 'I did 1, 2, and 4, skipped 3' AI: 'Got it all. [Summary].' Don't force one-by-one if they gave everything.

**Notes:**

Pace should be conversational, not robotic.

---

### `ECHECK-04` — Goal Check (if morning goal set)

**Name:** Goal Check (if morning goal set) · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Legacy / Older Plan · **Route:** /checkin/evening/goal · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** complete_checkin, llm_call · **session_log:** voice_started, voice_ended, goal_outcome_logged, llm_call · **Tasks:** P2-29, P2-34

**Screen text (Figma):**

[No screen element - voice only]

**AI Context Block:**

SCREEN: Goal Check (evening, if morning goal exists)
STATE: User set a morning goal. Now checking in on it.
BEHAVIOR: Cartesia Sonic API voice: 'You said this morning you wanted to [goal]. How'd that go?' Achieved: attribute to user. Missed: 'No stress. Tomorrow's a fresh one.' Partial: 'Progress counts.'
DO NOT: Guilt. Validate excuses. Push back. Extended commentary.

**Voice Content:**

Live LLM via Cartesia Sonic API:
'You said this morning you wanted to [goal_text]. How'd that go?'

Responses:
ACHIEVED: 'You said you wanted to [goal] and you did. That's you following through.'
MISSED: 'No stress. Tomorrow's a fresh one.'
PARTIAL: 'Progress counts. You moved it forward.'

**Voice Instructions:**

[Only if daily_goals exists for today. LLM-driven via Cartesia Sonic API]

**Voice Notes:**

Async reflection. LLM via Cartesia Sonic API.

**Expected user response:**

ACHIEVED: 'I did it' / 'Yeah!' / 'Nailed it' / 'Got it done'
MISSED: 'No' / 'Didn't happen' / 'Not today'
PARTIAL: 'Sort of' / 'I started it' / 'Got halfway'

**AI Response:**

[See AI Voice column for response variations]

**System Action:**

1. Update daily_goals.status = achieved/missed/partial
2. Transition to ECHECK-05 if reflection configured
3. Otherwise: ECHECK-06 (wrap up)

**Edge Cases:**

Emotional response ('I'm so proud of myself'): AI: 'You should be. That was all you.'
Excuse-heavy response: AI does NOT validate excuses or push back. Just acknowledges and moves on.

**Notes:**

Evening goal reference = the payoff of the morning goal question.

---

### `ECHECK-05` — Daily Reflection

**Name:** Daily Reflection · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Screen (mapped to journal flow) · **Route:** /checkin/evening/reflection · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** open_journal, complete_journal_entry, llm_call · **session_log:** voice_started, voice_ended, reflection_logged, llm_call · **Tasks:** P2-29, P2-34

**Screen text (Figma):**

[Journal prompts displayed one at a time]

**AI Context Block:**

SCREEN: Daily Reflection (mandatory)
STATE: Habits reviewed. Now the reflection portion of evening check-in.
BEHAVIOR: Check user_profile.reflection_style:
- GUIDED: Three fixed prompts one at a time (proud, forgive, grateful). Brief 1-sentence reflection after each via Cartesia Sonic.
- CUSTOM: User's custom_prompts[] one at a time. Same brief reflection pattern.
- FREEFORM: Open prompt ('How was your day?'). One reflection. Close.
After final answer: 'Thank you for sharing that.' Then transition silently to ECHECK-06 for the evening wrap-up.
IF 'Nothing' / 'I don't know': 'That's OK. We can move to the next one.' Do NOT push.
IF emotional: Brief acknowledgment only. Do NOT therapize.
IF user wants to skip tonight: 'No problem. We'll do it next time.' -> wrap up.
DO NOT: Give long reflections. Ask follow-up questions. Steal the moment.

**Voice Content:**

Live LLM via Cartesia Sonic API (dynamic based on reflection_style):

IF GUIDED:
'Now let's do your reflection. What are you proud of today?'
[After answer:] '[Brief reflection]. Next - what do you forgive yourself for today?'
[After answer:] '[Brief reflection]. Last one - what are you grateful for?'
[After answer:] 'Thank you for sharing that.'

IF CUSTOM:
'Time for your reflection. [User's first custom prompt]?'
[Continue for all custom prompts]
[After final:] 'Thank you for sharing that.'

IF FREEFORM:
'Time for your reflection. How was your day? Just talk about whatever comes to mind.'
[After answer:] '[Brief reflection]. Thank you for sharing that.'

**Voice Instructions:**

[Dynamic - LLM generates based on reflection_style]
[Each prompt and reflection via Cartesia Sonic API]

**Voice Notes:**

Async reflection. LLM reads prompts, captures voice responses, responds via Cartesia Sonic API.

**Expected user response:**

Answers to each prompt - open-ended, emotional, personal. Some short ('Nothing' / 'I don't know'), some long.

**AI Response:**

[See AI Voice column. Brief, meaningful reflections between prompts.]

**System Action:**

1. Save each response to Supabase journal_entries {user_id, date, prompt, response, input_method}
2. After all prompts: transition to ECHECK-06
3. Log PostHog: journal_entry {prompt_count, total_length, input_method}

**Edge Cases:**

'Nothing' / 'I don't know': AI: 'That's OK. Sometimes nothing comes to mind. We can move to the next one.' Do NOT push.
User gets emotional: AI: Brief acknowledgment. 'That sounds like it matters a lot.' Do NOT therapize.
User wants to skip reflection tonight: 'No problem. We'll do it next time.' -> skip to wrap up

**Notes:**

AI responses to reflections should be brief - 1 sentence. Don't steal the moment.

---

### `ECHECK-06` — Evening Wrap-up

**Name:** Evening Wrap-up · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Legacy / Older Plan · **Route:** /checkin/evening/wrap · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-01, UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** complete_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, checkin_completed, llm_call · **Tasks:** P2-29, P2-30, P2-34

**Screen text (Figma):**

[Return to home screen]

**AI Context Block:**

SCREEN: Evening Wrap-up
STATE: Habits reviewed, goal checked, reflection done. Last voice before bed.
BEHAVIOR: Summarize: '[X] out of [Y] habits today. [Brief comment]. See you tomorrow morning, [Name].' All done = 'Full day. Rest well.' Most = 'Solid day.' Few = 'Some days are like that. Tomorrow's fresh.' None = 'That's OK. Tomorrow we start again. Sleep well.'
May use MP3 closings matched to mood OR LLM-generated via Cartesia Sonic.
DO NOT: Pile on if bad day + bad mood. Be preachy. End on anything but warmth.

**Voice Content:**

Live LLM via Cartesia Sonic API OR MP3 closings:
ALL COMPLETE: 'All habits done today. That's a full day. Rest well.'
MOST: 'Three out of four - solid day. Rest well, [Name].'
FEW: 'One out of four today. Some days are like that. Tomorrow's fresh.'
NONE: 'Sometimes the day doesn't go as planned. That's OK. Tomorrow we start again. Sleep well, [Name].'

**Voice Instructions:**

[Dynamic - based on habit completion count]
[MP3 closings (mood-matched) OR LLM via Cartesia Sonic API]

**Voice Notes:**

Async reflection. MP3 closing matched to completion rate, OR LLM via Cartesia Sonic for personalized.

**Expected user response:**

-

**AI Response:**

[See AI Voice column for variations by completion rate]

**System Action:**

1. Calculate daily completion rate
2. Update streak data
3. Play closing MP3 OR LLM via Cartesia Sonic
4. Return to Home
5. Log PostHog: evening_complete {habits_completed, habits_total, had_goal, goal_status, reflection_done}

**Edge Cases:**

NONE done + bad mood from morning: AI does NOT pile on. Keep it gentle. 'Rest well tonight. Tomorrow's a new start.'
Perfect day + good mood: 'Clean sweep today. You earned a good night's rest.'

**Notes:**

Last voice they hear before bed. Warm, brief, forward-looking.

---

### `EVENING-REFLECTION-ENTRY` — Journal - Entry Detail

**Name:** Journal - Entry Detail · **Phase:** Phase 2 · **Active:** Yes · **Type:** Tap-only · **Row Type:** Screen · **Route:** /journal/:id · **Voice Engine:** None · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1569-23431 · **Figma node:** 1569:23431

**Screen text (Figma):**

Journal Entry
March 2026
Tuesday, March 3, 2026
Awesome
Today was surprisingly productive. I managed to finish the core logic of the habit tracker and even started the UI design. I feel a sense of flow and accomplishment that I haven't felt in weeks.
AI Insight
You've maintained a 5-day streak of high productivity. Data suggests evening journaling helps you process accomplishments more effectively. Keep it up!
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Single journal entry detail (read mode)
STATE: User saved a journal entry, or tapped a row in RECENT-REFLECTIONS.
BEHAVIOR: Read-only view of the entry: date, time, mood tag, body text, AI Insight section.
NEXT: tap edit → JOURNAL-EDIT. Back → previous screen.

**Voice Content:**

(no audio - read-only view)

**Voice Instructions:**

[silent]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap edit pencil, back arrow.

**AI Response:**

(no AI response on this screen)

**System Action:**

1. Load entry by id
2. Display content + AI Insight
3. Edit/back navigation

**Edge Cases:**

Edit while AI insight is loading: edit possible, insight refreshes.

**Notes:**

Reachable from HOME-DEFAULT (recent reflection card) and RECENT-REFLECTIONS list.

---

### `EVENING-REFLECTION-FREEFORM` — Journal - Freeform

**Name:** Journal - Freeform · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /journal/freeform · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1035-5158 · **Figma node:** 1035:5158

**Screen text (Figma):**

Freeform
Guided Reflection
Tuesday, March 3  • 08:30 AM
Title (Optional) :
What's on your mind today, Jeff? Type or tap the mic to speak
Type here...
Save
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Freeform journal entry
STATE: User on HOME-DAILY-REFLECTION picked 'Freeform'.
BEHAVIOR: Single text area + voice option. Open prompt: 'What's on your mind today?' User writes/speaks anything. Save creates a JOURNAL-ENTRY.
NEXT: JOURNAL-ENTRY.

**Voice Content:**

What's on your mind today?

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Voice or type freely.

**AI Response:**

Brief warm acknowledgment after save.

**System Action:**

1. Display textarea + voice option
2. User writes/speaks
3. Save → JOURNAL-ENTRY

**Edge Cases:**

Empty save: discard.

**Notes:**

Companion to JOURNAL-GUIDED.

---

### `EVENING-REFLECTION-GUIDED` — Journal - Guided Reflection

**Name:** Journal - Guided Reflection · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /journal/guided · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1035-5097 · **Figma node:** 1035:5097

**Screen text (Figma):**

Freeform
Guided Reflection
Tuesday, March 3  • 08:30 AM
Tap here to switch between guided prompts and freeform writing
What are three things you are grateful for today?
Type here...
What are the things you are proud for today?
Type here...
What are the things you are forgive for today?
Type here...
Save
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Guided Reflection journal entry
STATE: User on HOME-DAILY-REFLECTION picked 'Guided Reflection'.
BEHAVIOR: Three prompts in order: (1) 'I am proud of myself today for...' (2) 'I forgive myself today for...' (3) 'I am grateful for...'. User responds via voice or text per prompt. Save creates a JOURNAL-ENTRY.
NEXT: JOURNAL-ENTRY (read-mode of saved entry).

**Voice Content:**

Let's go through three quick prompts. Take your time.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Voice or text response per prompt.

**AI Response:**

Brief acknowledgment after each. Closing after final.

**System Action:**

1. Display 3 prompts sequentially
2. User responds
3. Save entry → JOURNAL-ENTRY

**Edge Cases:**

User skips a prompt: blank response saved, advance.

**Notes:**

Timothy item #4: prompt order + wording locked: (1) proud of myself today (2) forgive myself today (3) grateful for. Replaces older 'What are you grateful for?' question style.

---

### `HOME-DAILY-REFLECTION` — Home - Daily Reflection

**Name:** Home - Daily Reflection · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /home/reflection · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1035-5391

**Screen text (Figma):**

(see Figma)

**AI Context Block:**

SCREEN: Daily Reflection (home state)
STATE: User tapped 'Open Journal' / Daily Reflection card on HOME-DEFAULT.
BEHAVIOR: Tab interface — Freeform / Guided Reflection. User picks mode → JOURNAL-FREEFORM or JOURNAL-GUIDED.
NEXT: JOURNAL-GUIDED or JOURNAL-FREEFORM.

**Voice Content:**

Time to reflect on your day. Pick guided prompts or just talk freely.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap Guided Reflection or Freeform tab.

**AI Response:**

Brief intro to chosen mode.

**System Action:**

1. Display tab interface
2. User picks mode
3. Navigate to JOURNAL-GUIDED or JOURNAL-FREEFORM

**Edge Cases:**

User dismisses: return to HOME-DEFAULT.

**Notes:**

Hub for evening reflection feature. Replaces ECHECK-05 standalone screen.

---

### `MCHECK-01` — Morning Check-in

**Name:** Morning Check-in · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Screen (mapped to home state variant) · **Route:** /checkin/morning · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-01, UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** start_checkin, complete_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, checkin_completed, llm_call · **Tasks:** P2-29, P2-30, P2-34, P2-37

**Screen text (Figma):**

"How are you feeling?"
Sleep Quality: Poor/Fair/Good/Great/Deep!
Mood: Awful/Bad/Meh/Good/Awesome!
Energy Level: Drained/Low/Medium/Active/Charged
Stress Level: Extreme/High/Moderate/Light/Relaxed
Button: "Check In"

**AI Context Block:**

SCREEN: Morning Check-in (async reflection pattern, NOT Vapi)
STATE: User starting morning check-in. Four scales: sleep, mood, energy, stress, plus optional voice goal at MCHECK-02.
BEHAVIOR (v2 plan async pattern):
1. MP3 prompt plays in Yair's cloned voice ('Morning, [Name]. Quick check-in.').
2. User responds via voice (Soniox streaming STT) or taps emoji scales.
3. MP3 thinking acknowledgment plays while LLM processes (target 2-3s).
4. LLM-generated personalized response sent to Cartesia Sonic API for live TTS in cloned voice.
5. Optional follow-up if needed.
6. MP3 closing matched to mood (or transition to MCHECK-02).
Cost target: ~$0.006/check-in.
PARSING: 'exhausted' = Energy: Drained. 'anxious' = Stress: High. 'fine' = ambiguous, clarify.
DO NOT: Give speeches. Try to fix bad mornings. Extend beyond 2 sentences. Use Vapi (use async reflection pattern instead).
NEXT: All scales -> MCHECK-02 (morning goal).

**Voice Content:**

Multi-segment:

Prompt MP3 (Yair voice from Supabase Storage): 'Morning. Quick check-in - sleep, mood, energy, stress. Just tap or tell me.'

Thinking ack MP3 (Yair voice, varies): 'Got it...' / 'Hmm, let me see...' / 'OK...'

Live LLM response (Cartesia Sonic API, live TTS, varies): 'Solid sleep, [Name]. Use that energy today.' / 'Tough start. That's real. Let's keep it light today.' / 'Sleep was rough but energy's up - interesting. Let's work with what you've got.'

**Voice Instructions:**

[Async reflection pattern - NOT Vapi]
State machine:
1. PROMPT: MCHECK-01 loads, plays prompt MP3 from Supabase Storage
2. LISTENING: Mic activates for user voice (Soniox STT) OR user taps scales
3. THINKING: 'Check In' tapped or voice complete -> thinking ack MP3 plays while LLM processes
4. RESPONDING: LLM response streamed to Cartesia Sonic API for live TTS in cloned voice
5. FOLLOWUP_OPTIONAL: Tap-to-talk if user wants to elaborate
6. CLOSING: MP3 closing plays (or transitions to MCHECK-02)
7. DONE

**Voice Notes:**

Async reflection (NOT Vapi). Yair voice MP3 prompt + thinking ack + closing from Supabase Storage. LLM-generated personalized response via Cartesia Sonic API live TTS. Voice + text sync (UX-22) shows text alongside audio.

**Expected user response:**

VOICE (all): 'Slept great, mood's good, energy high, no stress.'
VOICE (partial): 'Slept OK' / 'I'm tired'
TAP: Select emojis -> Check In

VARIATIONS:
'Great'/'Good'/'OK'/'Bad'/'Terrible' = map to scale
'Exhausted' = Energy: Drained
'Anxious' = Stress: High
'Fine' = ambiguous

**AI Response:**

ALL CLEAR: [Brief LLM response via Cartesia Sonic - varies by check-in values]
ALL NEGATIVE: 'Tough start. That's real. Let's see how the day unfolds - sometimes it shifts.'
MIXED: 'Sleep was rough but energy's up - interesting. Let's work with what you've got.'

**System Action:**

1. Play prompt MP3 from Supabase Storage
2. Open Soniox STT for voice input (parallel with tap UI)
3. On 'Check In' tap or voice complete: parse to 5-point scales
4. Save to Supabase checkins {user_id, type: 'morning', date, sleep, mood, energy, stress}
5. Play thinking ack MP3
6. Call LLM via callLLM() with check-in context
7. Stream LLM response to Cartesia Sonic API for live TTS
8. Display text alongside audio (UX-22 voice + text sync)
9. Transition to MCHECK-02
10. Log PostHog: complete_checkin {type: 'morning', input_method, values}

**Edge Cases:**

PARTIAL (1-2 only): 'Got it - [what they said]. And how about [remaining]? You can just tap the rest.'
AMBIGUOUS ('I'm fine'): 'Fine as in good, or fine as in just getting by?'
ALL NEGATIVE: AI does NOT try to fix. Acknowledges, moves forward.
'I don't want to do this today': 'That's OK. You can skip. I'll be here tomorrow.' -> close
'I'm tired': 'Tired as in low energy, or didn't sleep well? Or both?'

TAP + VOICE MIX: User fills some scales via tap, then taps 'Check In' before completing all: System saves what's filled. Unfilled scales are skipped for today. AI acknowledges what it got: 'Got it - [filled scales]. Have a good one, [Name].'

**Notes:**

Between 30 seconds and a couple of minutes total. Keep it moving. Async reflection pattern is the v2 plan - NOT Vapi.

---

### `MCHECK-02` — Morning Goal (Voice Only)

**Name:** Morning Goal (Voice Only) · **Phase:** Phase 2 · **Active:** Planned · **Type:** Async Reflection · **Row Type:** Legacy / Older Plan · **Route:** /checkin/morning/goal · **Voice Engine:** AsyncReflection · **Voice Mode:** Generative · **Stage:** Stage 5 · **UX Rules:** UX-01, UX-02, UX-04, UX-13, UX-21, UX-22 · **PostHog:** complete_checkin, llm_call · **session_log:** navigate, voice_started, voice_ended, goal_set, llm_call · **Tasks:** P2-29, P2-30, P2-34

**Screen text (Figma):**

[No screen element - voice only]

**AI Context Block:**

SCREEN: Morning Goal (voice only, async reflection pattern)
STATE: Check-in complete. Optional daily goal.
BEHAVIOR: MP3 prompt asks 'Anything specific you want to make happen today?' If goal set, LLM-generated confirmation via Cartesia Sonic API. If no goal, MP3 closing with 'have a good day'. If vague ('be productive'), ask for something specific. If still vague, move on.
DO NOT: Push for a goal. Make skipping feel bad. Accept multiple goals (focus on one). Use Vapi.
NEXT: Return to Home.

**Voice Content:**

Prompt MP3 (Yair voice): 'Anything specific you want to make happen today? A goal we can check back on tonight?'

Live LLM response (Cartesia Sonic API):
GOAL SET: 'Got it - [goal]. I'll ask you about it tonight.'
NO GOAL: 'All good. Have a great day, [Name].'
VAGUE: 'Is there anything specific you could check off by tonight?'

**Voice Instructions:**

[Async reflection pattern after MCHECK-01]
[MP3 prompt -> user voice -> LLM response via Cartesia Sonic]

**Voice Notes:**

Async reflection. MP3 prompt + LLM response via Cartesia Sonic API.

**Expected user response:**

GOAL: 'Hit the gym' / 'Finish my proposal' / 'Get to bed by 11'
NO GOAL: 'No' / 'Nah' / 'I'm good' / 'Not today'
VAGUE: 'Have a good day' / 'Be productive'

**AI Response:**

GOAL SET: 'Got it - [goal]. I'll ask you about it tonight.'
NO GOAL: 'All good. Have a great day, [Name].'
VAGUE: 'Is there anything specific you could check off by tonight?'
If still vague: 'No problem. Talk tonight.'

**System Action:**

1. Play prompt MP3 from Supabase Storage
2. Open Soniox STT for voice input
3. If goal: save to Supabase daily_goals {user_id, date, goal_text, status: 'pending'}
4. Store for evening reference (ECHECK-04)
5. LLM response via callLLM() -> Cartesia Sonic API
6. Return to Home
7. Log PostHog: morning_goal {has_goal, goal_text_length}

**Edge Cases:**

Multiple goals: 'Let's focus on one. Which is most important?'
Goal matches existing habit: 'That's already one of your habits today. Anything else beyond your regular habits?'
Emotional goal: treat same as any goal.

**Notes:**

Voice only. Not a text field.

---

### `RECENT-REFLECTIONS` — Recent Reflections (List)

**Name:** Recent Reflections (List) · **Phase:** Phase 2 · **Active:** Yes · **Type:** Tap-only · **Row Type:** Screen · **Route:** /journal · **Voice Engine:** None · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1569-23311 · **Figma node:** 1569:23311

**Screen text (Figma):**

Reflections
Recent Reflections
Scroll through your thoughts and milestones.
Today, 08:30 PM
Awesome
Today was surprisingly productive. I managed to finish the core logic of the habit tracker and even
started the UI design.
Yesterday, 10:15 PM
Calm
The evening walk really helped clear my mind. I need to remember to do this more often, especially after a long day of coding.
Saturday, Feb 28
Energized
Hit a new personal record at the gym today! Consistency is finally starting to pay off.
Friday, Feb 27
Peaceful
Started the day with 20 minutes of meditation. It really set a positive tone for everything else that
followed.
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Recent reflections list
STATE: User browsing past journal entries.
BEHAVIOR: List of past entries with date/time/mood/preview. Tap a row → JOURNAL-ENTRY (read mode). Back → HOME-DEFAULT.

**Voice Content:**

(no audio - tap-only list)

**Voice Instructions:**

[silent]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap a row, or back arrow.

**AI Response:**

(no AI response on this screen)

**System Action:**

1. Load entries (most recent first)
2. Display rows
3. Route to JOURNAL-ENTRY on row tap

**Edge Cases:**

Empty state (new user, no entries): friendly empty message.

**Notes:**

Reachable from HOME-DEFAULT 'See all' on Recent Reflections card.

---

### `REFLECTION-LOG` — Habit Reflection Log

**Name:** Habit Reflection Log · **Phase:** Phase 2 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /habits/:id/reflection · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1620-7657 · **Figma node:** 1620:7657

**Screen text (Figma):**

Log habit reflection
Tuesday, March 3  • 08:30 AM
Daily Hydration
Type here...
Save
Feedback
Open Chat
Home
Progress
Focus
Profile

**AI Context Block:**

SCREEN: Log Habit Reflection
STATE: User on HABIT-DETAIL tapped 'Log Habit Reflection'.
BEHAVIOR: Text/voice input for reflection on this specific habit. Vapi optionally listens. Save → return to HABIT-DETAIL.
DO NOT: Force voice. Make required.

**Voice Content:**

What's on your mind about [habit]?

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Type or speak reflection.

**AI Response:**

Brief acknowledgment after save.

**System Action:**

1. Display textarea + voice option
2. User types/speaks
3. Tap Save → persist + return to HABIT-DETAIL

**Edge Cases:**

Empty save: discard and return.

**Notes:**

Per-habit reflection (vs ECHECK/HOME-DAILY-REFLECTION which is daily across all habits).

---

_Last refreshed: 2026-05-11_