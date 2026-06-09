---
domain: contexts
title: Onboarding screens (ONBOARD-*)
primary:
  file: src/generated/screen_contexts.json
  symbol: (JSON bundle)
related:
  - file: api/_lib/llm/buildSystemPrompt.ts
    symbol: buildSystemPromptForRequest
  - file: api/_lib/llm/stripForwardPointers.ts
    symbol: stripForwardPointers
last_verified: 2026-06-09
---

# Onboarding screens (ONBOARD-\*)

Verbatim `context_block` text for each screen in this group — the **exact text the AI sees** as Layer 7 (ACTIVE SCREEN UPDATE) of its system prompt for Direct-LLM paths (after `stripForwardPointers` strips the `--- SUPPLEMENTARY ---` tail and forward pointers).

Vapi (Path 1) receives the **raw, unstripped** version of each block — including everything after `--- SUPPLEMENTARY ---`.

Source: `src/generated/screen_contexts.json` (bundle version 2026-05-20). Master Sheet → Supabase → bundle (byte-identical).

---

## ONBOARD-01--FORM

**Screen name:** Profile Setup · **Route:** `/onboarding/step-1` · **Bytes:** 6183 · `source: gg-spec packet + always-confirm pronunciation override`

```
SCREEN_ID: ONBOARD-01--FORM
SCREEN_NAME: Profile Setup
ROUTE: /onboard/01

SCREEN: Profile Setup (Step 1). First screen where the agent both speaks AND listens.
STATE: User just heard the WELCOME MP3, completed the presence ask, granted mic. They're engaged, mic is live. The Vapi agent session was opened in the background during WELCOME, so by the time this screen loads the agent is warm and can speak immediately.
FLOW:
1. Screen loads. Vapi session resumed (already open from WELCOME).
2. Agent speaks the opening line: asks for name, age, gender, referral.
3. User responds by voice OR taps form fields. Form auto-fills in real-time as agent parses speech.
4. Agent speaks the user's NAME back via live Cartesia TTS: "Great to meet you, [Name]."
5. Pronunciation check is ALWAYS performed, regardless of name commonness. Immediately after saying the name in step 4, the agent appends a short "— did I say that right?" (one beat, low-friction). If user says yes (or stays silent for ~1.5s), proceed. If no, agent asks user to say it slowly or spell it, then confirms by saying the name again. Cap at 2 retries — after 2 failed attempts, accept the user's spelling and move on without another pronunciation loop.
6. If user corrects pronunciation unprompted at any point ("actually it's Sara, no H"), agent enters correction mode regardless of where they are in the flow.
7. Pronunciation guide + spelling override stored on user_profile when set (used by future screens / sessions). Persistence pattern: write to user_profile.name_pronunciation_guide and user_profile.name_spelling_override; inject these into the system prompt on every subsequent callLLM() invocation (do NOT rely on Vapi-native session persistence — provider-agnostic).
8. If user gave partial info, agent asks ONLY for the remaining fields.
9. When all 4 fields are captured, agent fires `navigate_next` (voice) OR user taps "Let's Begin" (tap).
BEHAVIOR: Accept voice or taps interchangeably. Auto-fill form fields as voice is parsed. Confirm with a warm greeting using the user's name AND verify pronunciation EVERY TIME. Never assume a name was pronounced correctly first try, even for common names.
PARSING: "Call me Sam" -> name Sam. Age: "25" / "twenty-five" -> 25-34, "32" -> 25-34, "40" -> 35-44, "50" -> 45-54, "60" -> 55+, "20" -> 18-24. Gender: "guy/man/boy" -> Male, "girl/woman/lady" -> Female, "non-binary" -> Other. Referral: "a friend" -> Friend, "a webinar/on Zoom" -> Webinar, "you invited me/Yair sent me" -> Founder Invite. Buckets are the only valid values.
DO NOT: Re-ask fields already captured. Push on gender if declined. Make referral source feel mandatory. Get stuck in a pronunciation loop past 2 retries. Skip the pronunciation confirmation for common-looking names — always ask.
NEXT: All 4 fields filled -> save user_profile -> navigate to ONBOARD-FORK--FORM. Vapi session stays open.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent - live TTS, two-way conversation]
[Agent speaks the introduction automatically on screen load]
[Agent responds to user speech in real-time via: STT > GPT > TTS]
[Agent says the user's name back through live TTS in cloned voice]
[Form fields auto-fill as the user's speech is transcribed]
[If mic denied: introduction displays as text bubble, user fills form manually]

EXPECTED USER RESPONSE:
FULL: 'I'm Sarah, 32, female, I found you on Instagram.'
PARTIAL: 'Sarah, 32.' / 'My name's Mike.' / 'I'm 28.'
VARIATIONS:
'Call me Sam' = name: Sam
'Twenty-five' / '25' = age: 25
'Guy' / 'man' / 'boy' = Male
'Girl' / 'woman' / 'lady' = Female
'Non-binary' = Other
'TikTok' / 'IG' = Social media
'A friend' = Friend

OR Tap: Fill form manually

AI RESPONSE PATTERN:
*** Agent responds via Vapi live TTS (cloned voice) ***

FULL (user gave everything): 'Great to meet you, Sarah. Let's build something that actually works for you.' The agent says 'Sarah' (or whatever name the user gave) through live TTS. This is the moment - the AI coach knows their name and speaks it back.

PARTIAL (name + age only): 'Great to meet you, Sarah. And how do you identify? Also curious how you heard about us - you can just tap those on screen if you prefer.'

NAME ONLY: 'Hey [Name]. And how old are you?'

NO NAME YET: 'What should I call you?'

ALL VIA TAP (no voice): Agent does not speak a response. Form submission proceeds silently to ONBOARD-FORK.

SYSTEM ACTION:
1. On screen load: open Vapi agent session
2. Agent speaks introduction
3. Parse voice with NLP: extract {name, age, gender, referral_source}
4. Auto-fill form fields in real-time
5. On 'Let's Begin': validate all fields filled
6. Save to Supabase user_profile
7. Navigate to ONBOARD-FORK (Vapi session stays open)
8. Log PostHog: complete_profile {input_method, fields_via_voice}

EDGE CASES:
PARTIAL: AI asks for remaining fields only. Does NOT re-ask what it got.
AMBIGUOUS AGE: 'Did you say 30 or 13? Just want to make sure.'
UNCLEAR GENDER: 'I didn't catch how you identify. Male, female, or other?'
NO REFERRAL: Leave as 'Other' - not critical.
NAME UNCLEAR: 'Could you say your name one more time?'

NOTES:
FIRST REAL-TIME AGENT SCREEN. Voice auto-fills form in real-time - magic moment #1. Agent says the user's name back via live TTS - magic moment #2. NAME PRONUNCIATION: Common names (Sarah, Mike, Tim) will pronounce correctly. Uncommon names may be mispronounced by Cartesia TTS. Known limitation for MVP. Voice variant is ONBOARD-01--VOICE-STEP-1 (Figma node 1552:19403). Same logical screen, same data captured (name, age, gender, referral source), same tool calls fired. Rendering differs by mode per UX-24: voice variant shows chat UI with mic listening; form variant shows form fields.

VOICE_ACTIONS (this screen):
- fill_field(fieldName="nickname", value=<text>)
- fill_field(fieldName="age", value=<number 13-120 as string>)
- fill_field(fieldName="referralOtherText", value=<text>) — only when referralSource has been set to "Other"
- select_option(fieldName="gender", value=<one of: Male, Female, Other>)
- select_option(fieldName="referralSource", value=<one of: Founder Invite, Webinar, Friend, Other>)
- navigate_next when user says "continue" / "next"
```

---

## ONBOARD-FORK--FORM

**Screen name:** Experience Fork · **Route:** `/onboarding/step-2` · **Bytes:** 3073

```
SCREEN_ID: ONBOARD-FORK--FORM
SCREEN_NAME: Experience Fork
ROUTE: /onboard/02

SCREEN: Experience Fork (Step 2)
STATE: User completed profile. You know their name. Vapi agent is still active from ONBOARD-01.
REAL-TIME AGENT CONTINUES: The Vapi assistant session stays open from ONBOARD-01. GPT already has the user's name and profile data in conversation history. All AI speech on this screen is live TTS.
BEHAVIOR: Ask if they've tracked habits before. Route based on answer:
- New/first time/tried but didn't stick -> beginner path (ONBOARD-BEGINNER-01)
- Experienced/has a list/uses another app -> advanced path (ONBOARD-ADVANCED-01)
- Ambiguous ('sort of') -> clarify: 'Would you like me to guide you step by step, or do you have a list?'
IF NEW: Validate them. 'The fact that you're here means something.' Explain morning+evening check-ins briefly. IF EXPERIENCED: Respect their experience. Direct them to bring habits over one at a time.
DO NOT: Make 'new' feel lesser. Make 'experienced' feel like they're being tested.
NEXT: New -> ONBOARD-BEGINNER-01. Experienced -> ONBOARD-ADVANCED-01.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent continues from ONBOARD-01]
[Agent session stays open - same conversation context]
[All AI speech is live TTS, not pre-recorded]

EXPECTED USER RESPONSE:
NEW: 'I'm new to this' / 'Never done it' / 'First time' / 'I've tried but never stuck with it'
EXPERIENCED: 'Yeah I've done this before' / 'I use [app] right now' / 'I have a list'
AMBIGUOUS: 'Sort of' / 'A little bit'

OR Tap: Card -> Continue

AI RESPONSE PATTERN:
IF NEW: 'That's great. And honestly - the fact that you're here means something. A lot of people think about making changes. You actually did something about it. We're strengthening the part of you that showed up today. Let's go.'

IF EXPERIENCED: 'Nice - you've already been putting in the work. Just read them to me one by one. Tell me the name, how often, what time, and if you want a reminder. We'll get your whole system set up.'

SYSTEM ACTION:
1. Parse intent: new vs experienced
2. If new: onboarding_path = 'beginner', navigate to ONBOARD-BEGINNER-01
3. If experienced: onboarding_path = 'advanced', navigate to ONBOARD-ADVANCED-01
4. Log PostHog: select_onboarding_path {path, input_method}

EDGE CASES:
AMBIGUOUS ('sort of'): 'Sounds like you've dipped your toes in. Would you like me to guide you step by step, or do you already have a list?'
'I've tried but never stuck': route to beginner
MENTIONS SPECIFIC APP: route to advanced

NOTES:
Figma subtitle: 'How much experience do you have with habit tracking?' Voice variant is ONBOARD-FORK--VOICE (Figma node 1552:21655). Same logical screen, same data captured (habit-tracking experience: new vs experienced), same tool calls fired. Rendering differs by mode per UX-24.

VOICE_ACTIONS (this screen):
- set_path(value="simple") — user is new to habits / wants recommended habits
- set_path(value="braindump") — user is experienced / wants to dictate everything
- navigate_next when user has chosen a path and says "continue" / "next"
```

---

## ONBOARD-BEGINNER-01

**Screen name:** Category Selection · **Route:** `/onboarding/step-3` · **Bytes:** 2489

```
SCREEN_ID: ONBOARD-BEGINNER-01
SCREEN_NAME: Category Selection
ROUTE: /onboard/03

SCREEN: Category Selection (Step 3)
STATE: User chose beginner path. Ready to pick their focus area.
BEHAVIOR: Vapi agent asks what feels most worth improving. ONE category only. If they pick multiple, gently redirect: 'I'd recommend starting with one - which feels most urgent?' Each category gets a unique response - not generic praise. Sleep gets 'that's the foundation,' stress gets 'a few small habits can shift that more than you'd think,' etc.
CATEGORIES: Sleep Better, Move More, Eat Better, Feel More Energized, Reduce Stress, Improve Focus, Break Bad Habits, Get More Organized.
DO NOT: Allow multiple categories. Give generic 'great choice' responses. Overthink this moment.
NEXT: Category saved -> ONBOARD-BEGINNER-02 (subcategory).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent - live TTS, agent session continues from ONBOARD-01]
[Category responses (8 of them) can be MP3 in Phase 2 if static, but currently spoken via voice orchestrator]

EXPECTED USER RESPONSE:
SINGLE: 'Sleep' / 'I need better sleep' / 'Exercise' / 'Stress' / etc.
MULTIPLE: 'Sleep and stress' / 'A few things'

OR Tap: Card -> Continue

AI RESPONSE PATTERN:
SLEEP: 'Sleep - yeah. That's the foundation of everything else.'
MOVE: 'Movement - great call.'
EAT: 'Eating - smart place to start.'
ENERGY: 'Energy - the one that touches everything.'
STRESS: 'Stress - a few small habits can shift that.'
FOCUS: 'Focus isn't about willpower, it's about environment.'
BREAK: 'Recognizing it is the first step.'
ORGANIZED: 'That's the one that makes everything else easier.'

MULTIPLE: 'I'd recommend starting with one. Which feels most urgent?'

SYSTEM ACTION:
1. Save to user_onboarding.selected_categories[]
2. If multiple: prompt to narrow to one
3. Query habits DB for subcategories
4. Navigate to ONBOARD-BEGINNER-02
5. Log PostHog: select_category {category, input_method}

EDGE CASES:
VAGUE ('Everything'): 'If you had to pick just one thing that would make tomorrow better than today, what would it be?'
SPECIFIC HABIT ('stop smoking'): Map to category. 'That falls under breaking bad habits. Let's go there.'

NOTES:
One category only.

VOICE_ACTIONS (this screen):
- select_option(fieldName="category", value=<one of: Sleep better, Move more, Eat better, Feel more energized, Reduce stress, Improve focus, Break bad habits, Get more organized>)
- navigate_next when user says "continue" / "next" / "let's go"
```

---

## ONBOARD-BEGINNER-02

**Screen name:** Subcategory Selection · **Route:** `/onboarding/step-4` · **Bytes:** 2952

```
SCREEN_ID: ONBOARD-BEGINNER-02
SCREEN_NAME: Subcategory Selection
ROUTE: /onboard/04

SCREEN: Subcategory (Step 4)
STATE: User picked a category. Now narrowing to 1-2 specific goals within it.
BEHAVIOR: Vapi agent asks what specific thing within [category]. Offer 2-3 examples taken EXACTLY from the user's chosen category in GOAL OPTIONS BY CATEGORY below — never invent, rename, or paraphrase a goal. Play a unique subcategory response for whatever they pick (29 responses total, see SUB-* screens). Each response normalizes the issue and reframes it constructively.

GOAL OPTIONS BY CATEGORY (the user's chosen category is in USER KNOWN STATE above; offer ONLY the labels under it, verbatim):
- Sleep better: Fall asleep earlier | Wake up earlier | Sleep more consistently | Sleep more deeply
- Move more: Walk more | Exercise consistently | Improve mobility
- Eat better: Eat more intentionally | Reduce overeating | Plan food better
- Feel more energized: Have more morning energy | Avoid afternoon crashes | Keep energy more stable
- Reduce stress: Feel calmer during the day | Reduce evening stress | Feel less overwhelmed
- Improve focus: Start work with less friction | Do deeper work | Procrastinate less
- Break bad habits: Smoking | Weed | Alcohol | Porn | Phone use | Late-night snacking | Caffeine
- Get more organized: Stay on top of tasks | Keep spaces tidy | Handle life admin better
When saving goals, use these exact labels and include the user's COMPLETE current selection (all 1-2 goals, not just the latest).
RULES: 1 or 2 subcategories. If 1 sub = min 1 habit, max 3. If 2 subs = min 1 from each, max 3 total.
DO NOT: Let them pick more than 2 subcategories. Skip the subcategory response - it's a key coaching moment.
NEXT: Subcategory saved -> ONBOARD-BEGINNER-03 (habit selection).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS]
[Subcategory-specific response is the key coaching moment - see SUB-* screens for the 29 responses]

EXPECTED USER RESPONSE:
CLEAR: 'I can't fall asleep' / 'I want to wake up earlier'
VAGUE: 'All of it' / 'Just sleep in general'

OR Tap: Select -> Continue

AI RESPONSE PATTERN:
[See SUB-SLEEP-01, SUB-SLEEP-02, etc. for the 29 subcategory-specific responses. Each is a unique coaching response that normalizes and reframes.]

SYSTEM ACTION:
1. Save subcategory to user_onboarding.selected_subcategories[]
2. Query habits DB
3. Navigate to ONBOARD-BEGINNER-03
4. Log PostHog: select_subcategory {category, subcategory, input_method}

EDGE CASES:
VAGUE: 'If you had to pick just one - what bothers you the most?'
MULTIPLE: 'Let's start with the one that feels most urgent.'

NOTES:
1-2 subcategories. Dynamic template for examples.

VOICE_ACTIONS (this screen):
- select_multiple(fieldName="goals", values=<the COMPLETE selection of up to 2 goals, using the exact labels from GOAL OPTIONS BY CATEGORY for the chosen category>)
- navigate_next when user says "continue" / "next"
```

---

## ONBOARD-BEGINNER-03

**Screen name:** Habit Selection · **Route:** `/onboarding/step-5` · **Bytes:** 1831

```
SCREEN_ID: ONBOARD-BEGINNER-03
SCREEN_NAME: Habit Selection
ROUTE: /onboard/05

SCREEN: Habit Selection (Step 5)
STATE: Subcategory chosen. Habits database queried. Relevant habits displayed.
BEHAVIOR: Vapi agent presents habits from the database. Encourage 'doable, not heroic.' Accept 1-3 habits. If they want more than 3, gently redirect. Custom habits allowed - capture name via voice/text.
MINIMUM: At least 1 habit required before proceeding. Block Continue if 0 selected.
DO NOT: Let them skip with 0 habits. Discourage custom habits. Make more than 3 feel like failure.
NEXT: Habits selected -> ONBOARD-BEGINNER-04 (configure each habit).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS, agent session continues from ONBOARD-01]

EXPECTED USER RESPONSE:
SELECT: 'No screens after 10' / 'The first one'
CUSTOM: 'None of these fit' / 'I have my own idea'
TOO MANY: 'All of them'

OR Tap: Select 1-3 -> Continue

AI RESPONSE PATTERN:
SELECTED: 'Solid. [Specific comment]. Let's set it up.'
CUSTOM: 'No problem. Tell me the habit and I'll set it up.'
TOO MANY: 'I'd recommend starting with 2-3. Which ones feel most important?'

SYSTEM ACTION:
1. Save selected habit IDs
2. If custom: capture name via voice/text
3. Validate 1-3 selected
4. Navigate to ONBOARD-BEGINNER-04
5. Log PostHog: select_habit {habit_names[], count}

EDGE CASES:
ZERO SELECTED: 'We need at least one habit to get started.' Block Continue.
User overwhelmed: 'Just pick one. One is a perfect start.'

NOTES:
1-3 recommended. At least 1 required.

VOICE_ACTIONS (this screen):
- select_option(fieldName="habit", value=<one of the on-screen habit names>) — toggles a habit picker in the selecting phase
- remove_habit(name=<habit name>) — removes from selection / from configured list
- navigate_next when user says "continue" / "next"
```

---

## ONBOARD-BEGINNER-04

**Screen name:** Habit Configuration · **Route:** `/onboarding/step-6` · **Bytes:** 1926

```
SCREEN_ID: ONBOARD-BEGINNER-04
SCREEN_NAME: Habit Configuration
ROUTE: /onboard/06

SCREEN: Habit Configuration (Step 6)
STATE: User selected habits. Now configuring each one: time, frequency, reminder.
BEHAVIOR: Vapi agent asks when and how often for each habit. Accept voice or taps. Parse: 'every day at 9:30 PM with a reminder' = all 3 fields. If partial, ask for what's missing specifically. Auto-fill UI in real-time.
DEFAULTS: Sleep habits = 9-10 PM. Morning habits = 7-8 AM. Exercise = 6-7 PM.
PARSING: 'Every day' = all 7. 'Weekdays' = M-F. 'Before bed' = ask specific time.
DO NOT: Accept ambiguous times without clarifying. Skip reminders question.
NEXT: Last habit configured -> ONBOARD-BEGINNER-06 (review).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS, agent session continues from ONBOARD-01]

EXPECTED USER RESPONSE:
FULL: 'Every day at 9:30 PM with a reminder'
PARTIAL: 'Every day' (missing time) / 'At 9 PM' (missing frequency)
'Weekdays' / 'Before bed' / 'Mornings'

AI RESPONSE PATTERN:
FULL: 'Done - every day at 9:30 PM, with a reminder.'
MISSING TIME: 'Every day works. What time specifically?'
MISSING FREQUENCY: '9 PM, got it. And how often?'

SYSTEM ACTION:
1. Parse voice: extract {frequency, time, reminder}
2. Auto-fill UI in real-time
3. Save to Supabase habits
4. If more habits: loop ONBOARD-BEGINNER-04
5. If last habit: navigate to ONBOARD-BEGINNER-06
6. Log PostHog: configure_habit

EDGE CASES:
'Before bed': 'What time is that for you?'
'I'm not sure': Use reasonable default (sleep=9PM, morning=7AM)
USER CHANGES MIND: 'Actually make that 10 PM' - 'Updated to 10 PM.'

NOTES:
Voice auto-fills form in real-time.

VOICE_ACTIONS (this screen):
- update_habit(name=<current habit>, patch={time?, days?, reminder?, schedule?}) — edits the habit currently being customized in the bottom sheet
- navigate_next when user says "next" to advance to the next habit (or finish)
```

---

## ONBOARD-BEGINNER-05

**Screen name:** Beginner - Configure Habit #2 · **Route:** `_(modal, no route)_` · **Bytes:** 959

```
SCREEN_ID: ONBOARD-BEGINNER-05
SCREEN_NAME: Beginner - Configure Habit #2
ROUTE: /onboard/beginner/05

SCREEN: Configure 2nd habit (beginner path step 5)
STATE: User configured habit #1 in BEGINNER-04. Now configuring habit #2 if they picked 2 habits.
BEHAVIOR: Same as BEGINNER-04 — bottom-sheet modal asks WHEN, HOW OFTEN, REMINDERS for habit #2. Different example habit shown.
NEXT: BEGINNER-06 (review).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi live TTS]

EXPECTED USER RESPONSE:
Voice or tap configures time/frequency/reminder.

AI RESPONSE PATTERN:
Confirms config, advances.

SYSTEM ACTION:
Same as BEGINNER-04, just for the 2nd selected habit.

EDGE CASES:
Skipped if user only picked 1 habit at BEGINNER-03.

NOTES:
Companion to BEGINNER-04 — same screen, different habit data.

VOICE_ACTIONS (this screen):
- update_habit(name=<current habit>, patch={time?, days?, reminder?, schedule?})
- navigate_next when user says "done" / "finish"
```

---

## ONBOARD-BEGINNER-06

**Screen name:** Review Habits · **Route:** `/onboarding/step-7` · **Bytes:** 1469

```
SCREEN_ID: ONBOARD-BEGINNER-06
SCREEN_NAME: Review Habits
ROUTE: /onboard/07

SCREEN: Review Habits
STATE: All habits configured. User reviewing before moving to reflection setup.
BEHAVIOR: Vapi agent displays all configured habits. Asks if everything looks right. Handle edits via voice one at a time. Allow adding more habits here too. Keep this screen fast - momentum matters.
IF ADD: 'What habit would you like to add?' -> collect name, time, frequency, reminder.
DO NOT: Slow down. Add unnecessary commentary. Make them second-guess.
NEXT: Confirmed -> ONBOARD-BEGINNER-07 (reflection setup).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS, agent session continues from ONBOARD-01]

EXPECTED USER RESPONSE:
CONFIRM: 'Looks good' / 'Perfect'
EDIT: 'Change [habit] to [time]'
ADD: 'I want to add another habit'

AI RESPONSE PATTERN:
CONFIRM: 'Locked in.'
EDIT: 'Updated. How's that now?'
ADD: 'Sure - what habit would you like to add?'

SYSTEM ACTION:
1. Display habits from state
2. On confirm: navigate to ONBOARD-BEGINNER-07
3. Log PostHog: confirm_habits {habit_count, edits_made}

EDGE CASES:
User deletes a habit: 'Removed. Anything else?'
User adds here: mini habit creation flow.

NOTES:
Quick screen. Momentum matters.

VOICE_ACTIONS (this screen):
- remove_habit(name=<habit>) — drop from final list
- confirm_plan when user says "looks good" / "start" / "continue"
- navigate_next when user wants to advance to journal/reflection setup
```

---

## ONBOARD-BEGINNER-07

**Screen name:** Journal Setup · **Route:** `/onboarding/step-7` · **Bytes:** 2853

```
SCREEN_ID: ONBOARD-BEGINNER-07
SCREEN_NAME: Journal Setup
ROUTE: /onboard/08

SCREEN: Evening Reflection Setup (MANDATORY)
STATE: Habits confirmed. This is the last setup step before the final plan.
BEHAVIOR: Vapi agent presents reflection options. Reflection is mandatory. The user picks ONE of three styles:
1. Guided prompts (recommended): 'I'll ask you three simple questions each evening. You just answer.' Questions: What are you proud of? What do you forgive yourself for? What are you grateful for?
2. Custom prompts: 'Write your own questions. I'll ask them each evening.'
3. Freeform: 'No questions. Just talk about your day however you want.'
FRAMING: 'Two minutes at the end of your day. It helps you notice what's working, let go of what isn't, and build self-awareness that compounds over time. Most people feel a difference within a week or two.'
DO NOT: Present reflection as optional. Use the word 'journal' (say 'reflection'). Make it feel like homework. Skip the why.
NEXT: Style chosen -> ONBOARD-BEGINNER-10 (final plan). SUPABASE: reflection_style = 'guided' | 'custom' | 'freeform'. journal_configured = true always.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS, agent session continues from ONBOARD-01]

EXPECTED USER RESPONSE:
GUIDED: 'The first one' / 'Guided' / 'Three questions' / 'The recommended one'
CUSTOM: 'Custom' / 'My own' / 'I want to write my own'
FREEFORM: 'Freeform' / 'Just talk' / 'No questions' / 'The third one'
QUESTION: 'What are the three questions?' / 'Can I change later?'

OR Tap: Select option

AI RESPONSE PATTERN:
GUIDED: 'Good choice. Those three questions are simple but they change how you process your day. When do you want your evening check-in?'
CUSTOM: 'Nice. Add at least one question now, and you can always change them later in Settings. What's your first question?'
FREEFORM: 'No structure, just you. I'll capture everything. When do you want your evening check-in?'
WHAT ARE THE QUESTIONS: 'What am I proud of today? What do I forgive myself for today? What am I grateful for today? Three questions, two minutes.'
CAN I CHANGE: 'Anytime in Settings.'

SYSTEM ACTION:
1. Save reflection_style to user_profile: 'guided' | 'custom' | 'freeform'
2. If custom: collect prompts via voice/text
3. Save evening check-in time
4. Set journal_configured = true
5. Navigate to ONBOARD-BEGINNER-10
6. Log PostHog: configure_reflection

EDGE CASES:
User asks 'Do I have to?': 'Reflection is part of the experience - it's where the real change happens. Pick whichever feels easiest to start.'

NOTES:
Reflection is mandatory. Three styles. 'Reflection' not 'journal'.

VOICE_ACTIONS (this screen):
- set_reflection_config(time?"HH:MM", days?[0-6], reminder?bool, schedule?<Weekday|Weekend|Every day>) — partial patches OK
- navigate_next when user says "continue" / "skip" / "next"
```

---

## ONBOARD-BEGINNER-08

**Screen name:** Beginner - Journal Mode Choice · **Route:** `_(modal, no route)_` · **Bytes:** 863

```
SCREEN_ID: ONBOARD-BEGINNER-08
SCREEN_NAME: Beginner - Journal Mode Choice
ROUTE: /onboard/beginner/08

SCREEN: Journal mode choice (beginner path step 8)
STATE: After habit configuration. Now picking how the user wants to journal.
BEHAVIOR: Two-card choice: GUIDED (default 3 prompts: I am proud / I forgive / I am grateful) or CUSTOM PROMPTS (user defines own).
NEXT: BEGINNER-09 (check-in schedule).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi live TTS]

EXPECTED USER RESPONSE:
VOICE/TAP: Guided / Custom Prompts.

AI RESPONSE PATTERN:
Save user_profile.reflection_style. Advance.

SYSTEM ACTION:
1. Display two-card choice
2. User picks one
3. Save reflection_style
4. Navigate to BEGINNER-09

EDGE CASES:
Custom picked but no prompts: default to (I am proud, I forgive, I am grateful) — user can edit later.

NOTES:
Companion to ONBOARD-ADVANCED-04.
```

---

## ONBOARD-BEGINNER-09

**Screen name:** Beginner - Check-in Schedule · **Route:** `_(modal, no route)_` · **Bytes:** 945

```
SCREEN_ID: ONBOARD-BEGINNER-09
SCREEN_NAME: Beginner - Check-in Schedule
ROUTE: /onboard/beginner/09

SCREEN: Check-in schedule (beginner path step 9)
STATE: Reflection mode chosen. Now setting WHEN to do morning + evening check-ins.
BEHAVIOR: Two time pickers: Morning check-in (default 7am) and Night check-in (default 10pm). Reminder toggles for each. Optional — user can skip and configure later in Settings.
NEXT: BEGINNER-10 (starting plan).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi live TTS]

EXPECTED USER RESPONSE:
Tap time pickers to adjust. Toggle reminders.

AI RESPONSE PATTERN:
Confirm and advance.

SYSTEM ACTION:
1. Display morning + night check-in time pickers + reminders
2. User adjusts or accepts defaults
3. Save to user_profile.checkin_schedule
4. Navigate to BEGINNER-10

EDGE CASES:
User skips: keep defaults (7am morning, 10pm evening, reminders ON).

NOTES:
Replaces the legacy REMIND-01 row from older spec.
```

---

## ONBOARD-ADVANCED

**Screen name:** Advanced Onboarding - Voice Goals (post-MVP) · **Route:** `/onboarding/advanced-input` · **Bytes:** 1321

```
SCREEN_ID: ONBOARD-ADVANCED
SCREEN_NAME: Advanced Onboarding - Voice Goals (post-MVP)
ROUTE: /onboard/advanced/01

SCREEN: Advanced Onboarding - Voice Goals (post-MVP)
STATE: User chose advanced path at ONBOARD-FORK. Has experience with habits already.
BEHAVIOR: Vapi agent asks user to bring their habits over one at a time. Captures name, time, frequency, reminder via voice or tap.
NEXT: All habits captured -> ONBOARD-ADVANCED-02 (AI plan review).
NOTE: Currently planned for post-MVP. May be activated earlier if needed.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent, advanced onboarding path]

EXPECTED USER RESPONSE:
Voice: '[habit name], [frequency], [time], [reminder yes/no]'

AI RESPONSE PATTERN:
Confirmation per habit: '[habit] at [time], [frequency], [reminder status]. Got it. Anything else?'

SYSTEM ACTION:
1. Vapi agent loop per habit
2. Save each to Supabase habits
3. Continue until user says 'done' or 'that's all'
4. Navigate to ONBOARD-ADVANCED-02

EDGE CASES:
User has many habits: don't rush, take them one at a time.

NOTES:
Post-MVP feature. Advanced path for users with existing habit list.

VOICE_ACTIONS (this screen):
- fill_field(fieldName="brainDumpText", value=<the entire user transcript verbatim, appended to existing text>)
- navigate_next when user says "done" / "continue"
```

---

## ONBOARD-ADVANCED-02

**Screen name:** Advanced Onboarding - AI Plan Review (post-MVP) · **Route:** `/onboarding/advanced-results` · **Bytes:** 1119

```
SCREEN_ID: ONBOARD-ADVANCED-02
SCREEN_NAME: Advanced Onboarding - AI Plan Review (post-MVP)
ROUTE: /onboard/advanced/02

SCREEN: Advanced Onboarding - AI Plan Review (post-MVP)
STATE: User completed advanced habit capture. AI now reviews and may suggest tweaks.
BEHAVIOR: Vapi agent reviews captured habits, may suggest small adjustments. User confirms or edits.
NEXT: Confirmed -> ONBOARD-BEGINNER-07 (reflection setup).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent reviews and confirms]

EXPECTED USER RESPONSE:
Voice: 'Looks good' / 'Change [X]' / 'Add [Y]'

AI RESPONSE PATTERN:
Confirmed: 'OK, locked in. Now let's set up your evening reflection.'
Edit: 'What do you want to change?'

SYSTEM ACTION:
1. List captured habits via Vapi
2. Allow voice/tap edits
3. On confirm: navigate to ONBOARD-BEGINNER-07

EDGE CASES:
User wants to add more after review: 'Sure, what else?'

NOTES:
Post-MVP. Pairs with ONBOARD-ADVANCED-01.

VOICE_ACTIONS (this screen):
- update_habit(name, patch) — edit an AI-generated habit
- remove_habit(name) — drop one
- navigate_next when user says "looks good" / "continue"
```

---

## ONBOARD-ADVANCED-03

**Screen name:** Advanced - Voice Journal Intro · **Route:** `_(modal, no route)_` · **Bytes:** 1156

```
SCREEN_ID: ONBOARD-ADVANCED-03
SCREEN_NAME: Advanced - Voice Journal Intro
ROUTE: /onboard/advanced

SCREEN: Voice Journal Intro (advanced path step 3)
STATE: User finished freeform habit setup. Now introducing the daily reflection / journaling feature.
BEHAVIOR: Vapi agent introduces the AI Voice Journal: 'You'll have an evening reflection where you can talk freely or follow guided prompts. Your voice gets transcribed and the AI helps you process the day.' User taps Continue.
DO NOT: Force a journal mode choice yet (next screen does that). Make the user feel they MUST journal.
NEXT: ONBOARD-ADVANCED-04 (journal mode choice).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS, ~6 sec, then user taps Continue]

EXPECTED USER RESPONSE:
Tap: Continue.

AI RESPONSE PATTERN:
User taps Continue. No verbal response expected.

SYSTEM ACTION:
1. Display intro screen with daily reflection card preview
2. Vapi agent speaks intro text
3. User taps Continue → ONBOARD-ADVANCED-04

EDGE CASES:
User taps before audio finishes: stop audio, advance.

NOTES:
Companion to ONBOARD-BEGINNER-07 (which has the same content for the beginner path).
```

---

## ONBOARD-ADVANCED-04

**Screen name:** Advanced - Journal Mode Choice · **Route:** `_(modal, no route)_` · **Bytes:** 1549

```
SCREEN_ID: ONBOARD-ADVANCED-04
SCREEN_NAME: Advanced - Journal Mode Choice
ROUTE: /onboard/advanced

SCREEN: Journal Mode Choice (advanced path step 4)
STATE: User has been introduced to journaling. Pick mode: Freeform OR Custom Prompts.
BEHAVIOR: Two options. FREEFORM = open mic, AI listens to whatever user shares, no prompts. CUSTOM PROMPTS = user defines their own 3 prompts (or starts with default 'I am proud / I forgive / I am grateful').
DO NOT: Force one option. Show GUIDED option (that's the beginner path). Force prompts to be set now if they pick Custom.
NEXT: ONBOARD-ADVANCED-05 (starting plan summary).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS]

EXPECTED USER RESPONSE:
VOICE: 'I'll just talk' / 'Custom prompts'.
TAP: Freeform Journaling card / Custom Prompts card.

AI RESPONSE PATTERN:
FREEFORM picked: 'Got it. Just open the mic and talk.' CUSTOM picked: 'Got it. You can set the prompts now or later.'

SYSTEM ACTION:
1. Display two cards (Freeform / Custom Prompts)
2. User picks one
3. Save user_profile.reflection_style
4. Navigate to ONBOARD-ADVANCED-05

EDGE CASES:
User picks Custom but doesn't set prompts: skip prompt entry, default to first 3 (proud/forgive/grateful), let user edit later in SETTINGS.

NOTES:
Companion to ONBOARD-BEGINNER-08 (beginner path equivalent).

VOICE_ACTIONS (this screen):
- set_reflection_config(time?, days?, reminder?, schedule?)
- select_option(fieldName="reflectionSchedule", value=<Weekday|Weekend|Every day>)
- navigate_next when user says "continue" / "next"
```

---

## ONBOARD-ADVANCED-05

**Screen name:** Advanced - Your Starting Plan · **Route:** `_(modal, no route)_` · **Bytes:** 1275

```
SCREEN_ID: ONBOARD-ADVANCED-05
SCREEN_NAME: Advanced - Your Starting Plan
ROUTE: /onboard/advanced

SCREEN: Starting Plan (advanced path final step)
STATE: User finished advanced onboarding (freeform goals + journaling setup). Showing summary of what was created.
BEHAVIOR: Display: habits AI organized for them, daily reflection schedule, schedule defaults. Vapi agent: 'Here's what we've got. You can always tweak this later.' User taps 'Start Plan' to enter HOME-DEFAULT.
DO NOT: Push edits now. Make user feel locked in.
NEXT: HOME-DEFAULT (start the app).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS, ~6 sec]

EXPECTED USER RESPONSE:
Tap: Start Plan.

AI RESPONSE PATTERN:
Welcome closing: 'Let's go.' Then auto-navigate.

SYSTEM ACTION:
1. Display plan summary (habits + reflection schedule)
2. Vapi agent speaks closing line
3. User taps Start Plan
4. Set onboarding_completed = true in Supabase
5. Navigate to HOME-DEFAULT

EDGE CASES:
User taps before audio finishes: skip audio, advance. Audio replay link in case user missed it.

NOTES:
Companion to ONBOARD-BEGINNER-10 (final summary for beginner path).

VOICE_ACTIONS (this screen):
- confirm_plan when user says "let's go" / "start" / "looks good"
- navigate_next when user wants to go back
```

---

## ONBOARD-ADV-CUSTOM

**Screen name:** Advanced - Custom Prompts · **Route:** `_(modal, no route)_` · **Bytes:** 1629

```
SCREEN_ID: ONBOARD-ADV-CUSTOM
SCREEN_NAME: Advanced - Custom Prompts
ROUTE: /onboard/advanced

SCREEN: Custom Reflection Prompts (advanced path)
STATE: User chose Custom Prompts on the journal-mode screen. They define their own reflection prompts, starting from defaults ('What am I proud of? / What do I forgive? / What am I grateful for?').
BEHAVIOR: User adds or edits prompts by voice or tap. Each spoken prompt is captured and added to their list. They can keep the defaults, replace them, or add more.
DO NOT: Force a specific number of prompts. Block on completeness - prompts stay editable later in Settings. Show the beginner Guided option.
NEXT: Back to the journal-mode screen, then ONBOARD-ADVANCED-05 (starting plan summary).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent live TTS]

EXPECTED USER RESPONSE:
VOICE: 'Add a prompt: what went well today' / 'Use proud, forgive, grateful'.
TAP: type prompts into the fields.

AI RESPONSE PATTERN:
On a prompt: 'Added - want another?' When the user is done: 'Great, those are saved.'

SYSTEM ACTION:
1. Capture each prompt the user provides
2. Call submit_custom_prompts(prompts) with the COMPLETE current list (replace, not append)
3. navigate_next when the user is done

EDGE CASES:
User gives no prompts: keep the default three (proud / forgive / grateful).

NOTES:
Reached only from ONBOARD-ADVANCED-04 when the user picks Custom Prompts. Code-only screen (no spec packet); content pending product review.

VOICE_ACTIONS (this screen):
- submit_custom_prompts(prompts=[...]) - replace the custom prompt list
- navigate_next when user says "done" / "continue"
```

---
