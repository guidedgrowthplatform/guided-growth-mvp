---
domain: tools
title: Onboarding tools — Vapi (12) + Direct-LLM (13) + ONBOARDING_TOOL_ADDENDUM
primary:
  file: api/_lib/llm/onboarding/schemas.ts
  symbol: ONBOARDING_TOOLS
related:
  - file: api/_lib/llm/tools.onboarding.ts
    symbol: ONBOARDING_TOOLS
  - file: api/_lib/llm/onboarding/systemPromptAddendum.ts
    symbol: ONBOARDING_TOOL_ADDENDUM
last_verified: 2026-06-09
---

# Onboarding tools

Two parallel registries.

- Vapi (Path 1, 12 tools) → `api/_lib/llm/tools.onboarding.ts`. Has `navigate_next`.
- Direct-LLM (Path 3, 13 tools) → `api/_lib/llm/onboarding/schemas.ts`. Has `confirm_step_complete` + `ask_clarification`.

## ONBOARDING_TOOL_ADDENDUM (Layer 3 of Direct-LLM system prompt for ONBOARD-\*)

```
## Onboarding Tool-Use Rules

The screen's BEHAVIOR block is your script for THIS screen. Drive the user through it — do not just chat. But it scripts only the current screen: never read out, paraphrase, or begin the NEXT screen's task or opening line, even if a BEHAVIOR / AI RESPONSE PATTERN line reads like one. Advancing is governed by the STAY ON THIS SCREEN AFTER A CHANGE rule below, which overrides the BEHAVIOR block on that point.

TOOL SCOPE. On onboarding screens you have ONLY the submit_*/add_habit/remove_habit/update_habit/confirm_step_complete/confirm_plan/ask_clarification tools. Do not attempt to call update_profile, navigate_next, log_event, or get_user_context — they are not available here.

PLAN REVIEW (ONBOARD-BEGINNER-06 / ONBOARD-ADVANCED-05). On the plan-review screen, when the user confirms their plan ("looks good", "let's go", "start", "I'm ready"), call confirm_plan — NOT confirm_step_complete. confirm_plan completes onboarding and enters the app.

CALL DATA TOOLS EAGERLY. The moment the user has stated enough for a submit_*/add_*/remove_* tool, call it. Do not ask permission, do not echo back, do not summarize ("got it, let me save that…"). Just call the tool, then continue with your next short coach line.

ADVANCING THE STEP. Call confirm_step_complete when the user is done with this step ("yes", "move on", "next", "looks good", "that's all"). You MAY call it in the SAME turn as a submit_*/add_*/remove_* tool: write the data tool, then confirm_step_complete — no separate confirmation turn required. Rules:
- NEVER call confirm_step_complete if required fields for the screen are still missing — keep asking instead.
- A short acknowledgement alongside confirm_step_complete is fine, but do NOT pre-narrate or start the next screen — the next screen greets the user itself.
- On a resume turn where all fields are already populated, if the user affirms, call confirm_step_complete. If they request a change, call the appropriate submit_* first.

STAY ON THIS SCREEN AFTER A CHANGE. When the user picks, switches, or changes a value and you call a submit_*/add_*/remove_* tool, do not start or pre-narrate the next screen on that turn. On that turn: (1) write the data tool, (2) keep the user on THIS screen — give a short acknowledgement, then either ask for the next still-missing field on this screen, or, once this screen's data is complete, ask one short "anything else, or shall we move on?" question (for a single-choice screen like the path fork: "Done — switched you to the advanced path. Ready to move on, or want to change anything?") — then (3) STOP and wait for the user's reply. Do NOT, in that same turn, describe, preview, or start the next screen's activity (e.g. do not say "let's get started, share your habits one by one") — even if the screen's BEHAVIOR / AI RESPONSE PATTERN scripts such a line. That scripted line belongs to whoever opens the NEXT screen, not to this confirmation turn. Call confirm_step_complete to advance once the screen's data is complete and the user is ready (subject to the ADVANCING THE STEP rules above).

EDIT MODE. If the user changes a value on a screen they already passed, call the SAME submit_* tool again with the new value. The server merges idempotently. EXCEPTION for an already-added habit: to change only its time and/or days, call update_habit (it preserves the habit's other fields) — do NOT re-call add_habit, which resets the unspecified fields to defaults.

NEVER ask the user to confirm or verify a captured value. Capture is final.

FIELD CAPTURE PATTERN (ONBOARD-01--FORM):
- Recognize names from: "Call me X", "I'm X", "My name is X", "Name's X", or a capitalized single-word reply on a name-asking screen.
- Age: "twenty-five", "25", "I'm 30" → "25" / "30" string.
- Gender: "guy/man/boy" → "Male"; "girl/woman/lady" → "Female"; "non-binary/they" → "Other".
- Referral: "TikTok/Instagram/IG" → social media variant; quote the user's words.
- Batch fields when the user volunteers them together — one submit_profile call with multiple fields, not one call per field.

PATH FORK (ONBOARD-FORK--FORM):
- "I'm new / first time / never tracked / no I haven't" → submit_path_choice(path="simple").
- "I have habits / I know what I want / already doing X" → submit_path_choice(path="braindump").
- Ambiguous ("sort of", "a little") or a question back to you → ask_clarification with the screen's scripted clarify question. Do NOT guess a path.
- This screen has no goals or habits yet — never list goal or habit suggestions here.
- Refer to the choices to the user as "beginner" and "advanced". Never say "simple" or "braindump" in your message.
- On a revisit/switch: if the user asks to switch (e.g. "switch to advanced", "go back to beginner"), call submit_path_choice with the new path, then ask a single "ready to move on, or change anything?" confirmation and WAIT — do not announce or begin the chosen path's activity this turn.

CATEGORY / HABIT / REFLECTION screens: map the user's intent to the closest enum value or screen option and call the tool.
GOALS screen (ONBOARD-BEGINNER-02): submit_goals strings MUST be copied verbatim from GOAL OPTIONS BY CATEGORY for the chosen category — never paraphrase. If a submit is rejected, re-call with the exact labels listed in the tool's error.

BRAIN DUMP (ONBOARD-ADVANCED): pass the user's full transcript verbatim — never summarize or rephrase.

ERROR RECOVERY. If a tool returns ok=false:
- max_habits_reached → tell the user to remove one first, offer to call remove_habit.
- Validation errors → briefly tell the user what was off and ask for the field again, then retry.

Never re-ask a field you just captured. After tools, your text response acknowledges and moves to the next still-missing field per the screen's BEHAVIOR.
```

## Vapi ONBOARDING_TOOLS (12) — `api/_lib/llm/tools.onboarding.ts`

```typescript
[
  {
    name: 'submit_profile',
    screen: 'ONBOARD-01--FORM',
    description:
      "Save profile fields (nickname, age, gender, referral source) to the database. DATA ONLY — this tool does NOT advance the user to the next screen. Use `navigate_next` for that, AFTER the user confirms they're ready. AUTO-CALL IMMEDIATELY the moment the user states any of these fields. Do not ask for permission. Do not summarize. Edit mode: re-call with only the field(s) the user is updating — never re-send unchanged values. Only include fields the user explicitly stated; never invent values. At least one field is required per call.",
    messages: {
      requestStart: "I'm saving that — anything else about yourself you want to add?",
      requestFailed: "Hmm, that didn't save. Want to say it once more?",
    },
    parameters: {
      type: 'object',
      properties: {
        nickname: {
          type: 'string',
          description: 'Preferred short name. Letters, digits, or underscores. 1–50 characters.',
        },
        age: {
          type: 'string',
          description: 'Age in years as a numeric string, e.g. "28". Must be 13–120 once parsed.',
        },
        gender: {
          type: 'string',
          description: 'Self-identified gender.',
          enum: ['Male', 'Female', 'Other'],
        },
        referral_source: {
          type: 'string',
          description:
            'How the user heard about the app. Free text — quote what the user said (e.g. "Friend", "Twitter", "Podcast: Huberman").',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_path_choice',
    screen: 'ONBOARD-FORK--FORM',
    description:
      'Save the user\'s chosen onboarding path (simple vs braindump). DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user signals their choice. Phrases like "I\'m new", "this is my first time" → simple. "I already have habits", "I know what I want to work on" → braindump. Do not ask for permission to save — just call.',
    messages: {
      requestStart: 'Locking your path in — sound right?',
      requestFailed: 'Let me try that again.',
    },
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: "User's chosen onboarding path.",
          enum: ['simple', 'braindump'],
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_category',
    screen: 'ONBOARD-BEGINNER-01',
    description:
      'Save the user\'s chosen category. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user names an improvement area, even loosely. Map to the closest of the 8 categories: "sleep more" → Sleep better, "be more active" → Move more, "eat healthier" → Eat better, "less stressed" → Reduce stress, "focus better" → Improve focus, "quit smoking/drinking/phone" → Break bad habits, "more organized/on top of things" → Get more organized, "more energy" → Feel more energized. Do not ask for permission — just call.',
    messages: {
      requestStart: 'Saving that — does that one feel right?',
      requestFailed: "Didn't catch that — could you say it once more?",
    },
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'One of the eight fixed category labels.',
          enum: [
            'Sleep better',
            'Move more',
            'Eat better',
            'Feel more energized',
            'Reduce stress',
            'Improve focus',
            'Break bad habits',
            'Get more organized',
          ],
        },
      },
      required: ['category'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_goals',
    screen: 'ONBOARD-BEGINNER-02',
    description:
      "Save the user's COMPLETE goal selection for this screen (1 or 2 goals). This REPLACES whatever was saved before, so EVERY call MUST include ALL goals the user currently wants — never just the newest one. If they pick one goal now and add a second later, call again with BOTH goals in the array. If they change their mind, call again with only the goals they now want. DATA ONLY — does NOT advance to the next screen; use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY when the user names a goal — do not ask permission. Goal labels must match the on-screen options exactly.",
    messages: {
      requestStart: 'Got it — want to add another goal, or are you good with that?',
      requestFailed: "Didn't catch all of them — what were they again?",
    },
    parameters: {
      type: 'object',
      properties: {
        goals: {
          type: 'array',
          description:
            'The COMPLETE current selection of 1-2 goal labels (exactly as shown on screen). Always send every goal the user wants, not just the latest — this array replaces the saved set.',
          items: { type: 'string' },
        },
      },
      required: ['goals'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_habit',
    screen: 'ONBOARD-BEGINNER-03',
    description:
      'Add (or edit) a habit. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms they\'re done adding habits. AUTO-CALL IMMEDIATELY the moment the user names a habit, even if they only say the name (e.g. "I want to walk more" → just call add_habit with name="Walk more" and NOTHING ELSE). Only `name` is required — the server fills sensible defaults for schedule/days/time/reminder when you don\'t pass them. Pass schedule/days/time/reminder only if the user explicitly said something about them. Call again with the same name to update an existing habit (edit mode). Server enforces a max of 2 habits — if you try a 3rd new habit the tool returns max_habits_reached and you should tell the user to remove one first. **Do not ask for permission, do not ask the user about timing or reminders before calling — just call with whatever you know.**',
    messages: {
      requestStart: 'Adding that habit — anything else you want to track?',
      requestFailed: "Hmm, that didn't add. Want to try again?",
    },
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Habit name, exactly as offered on the screen (e.g., "8,000+ steps", "No caffeine after 2 PM"). 1-100 chars.',
        },
        days: {
          type: 'array',
          description:
            'Days of week as 0-6 ints, 0=Sunday. Optional — omit to let server default to weekdays.',
          items: { type: 'number' },
        },
        time: {
          type: 'string',
          description:
            'Time of day in HH:MM 24-hour format, e.g. "08:30". Optional — omit to let server default to 09:00.',
        },
        reminder: {
          type: 'boolean',
          description:
            'Reminder notification toggle. Optional — omit to let server default to true.',
        },
        schedule: {
          type: 'string',
          description:
            'Preset matching the days array. Optional — omit to let server default to Weekday.',
          enum: ['Weekday', 'Weekend', 'Every day'],
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_habit',
    screen: 'ONBOARD-BEGINNER-03',
    description:
      'Remove a previously-added habit. DATA ONLY — does NOT advance to the next screen. AUTO-CALL IMMEDIATELY the moment the user asks to drop a habit ("remove the walking one", "scratch that", "no longer caffeine"). Name match is case-insensitive. Do not ask for permission — just call.',
    messages: {
      requestStart: 'Taking that one off — want to swap it for something else?',
      requestFailed: "Didn't catch which one — which habit?",
    },
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the habit to remove.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_habit',
    screen: 'ONBOARD-BEGINNER-06',
    description:
      'Edit an existing habit\'s schedule on the plan-review/confirm screen. DATA ONLY — does NOT advance the screen. Provide the habit `name` (case-insensitive) and ONLY the field(s) the user wants to change (time and/or days). Unspecified fields are PRESERVED — unlike add_habit, which resets them to defaults. Use when the user tweaks a habit they already added (e.g. "move meditation to 8am", "make running every day"). Fails if the habit isn\'t found — recover by offering to add it. Do not ask for permission — just call.',
    messages: {
      requestStart: 'Updating that habit — anything else to tweak?',
      requestFailed: "Hmm, couldn't update that — which habit, and what change?",
    },
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the existing habit to edit (case-insensitive). 1-100 chars.',
        },
        days: {
          type: 'array',
          description: 'New days of week as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        time: {
          type: 'string',
          description: 'New time of day in HH:MM 24-hour format, e.g. "08:00".',
        },
        reminder: { type: 'boolean', description: 'New reminder notification toggle.' },
        schedule: {
          type: 'string',
          description: 'New preset matching the days array.',
          enum: ['Weekday', 'Weekend', 'Every day'],
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_reflection_config',
    screen: 'ONBOARD-BEGINNER-07',
    description:
      'Save the user\'s evening reflection schedule. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user gives any signal about reflection timing (even just "evenings" or "around 9 PM"). All fields are optional — pass only what the user explicitly said and let the server fill the rest (defaults: schedule="Weekday", days=[1,2,3,4,5], time="21:45", reminder=true). If the user hasn\'t said anything specific yet, you can call with NO fields to lock in the defaults. **Do not ask the user clarifying questions about timing or reminders before calling — just call with whatever you know.**',
    messages: {
      requestStart: 'Setting your reflection time — feel good about that timing?',
      requestFailed: 'Let me try again — when did you want it?',
    },
    parameters: {
      type: 'object',
      properties: {
        time: {
          type: 'string',
          description: 'HH:MM 24-hour format. Optional — omit to default to 21:45.',
        },
        days: {
          type: 'array',
          description: 'Days as 0-6 ints, 0=Sunday. Optional — omit to default to weekdays.',
          items: { type: 'number' },
        },
        reminder: {
          type: 'boolean',
          description: 'Reminder notification toggle. Optional — omit to default to true.',
        },
        schedule: {
          type: 'string',
          description:
            'Schedule preset matching the days array. Optional — omit to default to Weekday.',
          enum: ['Weekday', 'Weekend', 'Every day'],
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_custom_prompts',
    screen: 'ONBOARD-ADV-CUSTOM',
    description:
      "Save the user's custom evening-reflection prompts. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user gives one or more prompts. The prompts array REPLACES the saved set — always send the COMPLETE current list the user wants, never just the newest one (if they had two and add a third, send all three). Do not ask for permission — just call.",
    messages: {
      requestStart: 'Saving your prompts — want to add another, or are you set?',
      requestFailed: "Didn't catch those — what were the prompts again?",
    },
    parameters: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          description:
            'The COMPLETE current list of custom reflection prompts. Always send every prompt the user wants, not just the latest — this array replaces the saved set.',
          items: { type: 'string' },
        },
      },
      required: ['prompts'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_brain_dump',
    screen: 'ONBOARD-ADVANCED',
    description:
      "Save the user's verbatim brain-dump text. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user finishes describing what they want to work on (after a natural pause of a sentence or two). Pass the FULL transcript verbatim — never summarize, never rephrase, never paraphrase. Server parses this. Do not ask for permission — just call.",
    messages: {
      requestStart:
        'Got it. Reading through what you said now — anything else you want me to know?',
      requestFailed: "Hmm, didn't quite catch all of that. Want to walk me through it again?",
    },
    parameters: {
      type: 'object',
      properties: {
        brain_dump_raw: {
          type: 'string',
          description: "User's verbatim brain-dump text. 10-5000 chars.",
        },
      },
      required: ['brain_dump_raw'],
      additionalProperties: false,
    },
  },
  {
    name: 'navigate_next',
    screen: '*',
    description:
      "Advance the user to the next onboarding screen. This is the ONLY tool that moves the user between screens — the submit_* tools just save data, they do NOT navigate. When to call: only AFTER the user has explicitly confirmed they're ready to move on. Ask first ('ready to continue?' / 'anything else for this section?' / 'want to head to the next part?'). When they say yes, call this tool. What to pass for target_step: the step number of the NEXT screen. From step-1 (profile) → 2. From step-2 (path choice) → 3. From step-3 (category/braindump) → 4. From step-4 (goals) → 5. From step-5 (habits) → 6. From step-6 (reflection) → 7. For users who back-navigated to edit an earlier screen: after they confirm 'go forward', call this with target_step = currentScreenStep + 1. They'll walk through the remaining screens one by one — that's intended. Do NOT pass target_step values that skip multiple screens at once. Never call this without an explicit user confirmation. The user must say 'yes' / 'sure' / 'continue' / 'next' / equivalent.",
    messages: {
      requestStart: 'Heading there now.',
      requestFailed: "Hmm, couldn't move screens — let me try once more.",
    },
    parameters: {
      type: 'object',
      properties: {
        target_step: {
          type: 'number',
          description:
            'The step number to advance to (integer, 1–10). Usually currentScreenStep + 1.',
        },
      },
      required: ['target_step'],
      additionalProperties: false,
    },
  },
  {
    name: 'confirm_plan',
    screen: 'ONBOARD-BEGINNER-06',
    description:
      'Complete onboarding from the plan-review screen (ONBOARD-BEGINNER-06 beginner / ONBOARD-ADVANCED-05 advanced). Call the moment the user confirms their starting plan and wants to begin ("looks good", "let\'s go", "start", "I\'m ready"). The frontend finishes onboarding and enters the app in response. Do not call before the plan-review screen.',
    messages: {
      requestStart: 'Locking in your plan — here we go.',
      requestFailed: 'Hmm, let me try that once more.',
    },
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Short telemetry-only note (e.g. "user said let\'s go").',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];
```

## Direct-LLM ONBOARDING_TOOLS (13) — `api/_lib/llm/onboarding/schemas.ts`

```typescript
[
  {
    name: 'submit_profile',
    description:
      'Persist profile fields the user volunteered on ONBOARD-01--FORM. Call immediately the moment the user has stated their nickname (or updates any field on this screen). Re-call with same fields to edit. Only include fields the user explicitly stated — never invent values. Do not ask permission.',
    parameters: {
      type: 'object',
      properties: {
        nickname: {
          type: 'string',
          description:
            'Preferred name as the user gave it (letters, spaces, common punctuation, accents OK). 1–50 characters.',
        },
        age: {
          type: 'string',
          description: 'Age in years as a numeric string, e.g. "28". Must be 13–120 once parsed.',
        },
        gender: {
          type: 'string',
          description: 'Self-identified gender.',
          enum: ['Male', 'Female', 'Other'],
        },
        referral_source: {
          type: 'string',
          description:
            'How the user heard about the app. Free text (e.g. "Friend", "Twitter", "Podcast: Huberman").',
        },
      },
      required: ['nickname'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_path_choice',
    description:
      'Persist the user\'s onboarding path choice on ONBOARD-FORK--FORM. "I\'m new" → simple. "I already have habits" → braindump. Call the moment the user signals; do not confirm.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: "User's chosen onboarding path.",
          enum: ['simple', 'braindump'],
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_category',
    description:
      'Persist the chosen improvement category on ONBOARD-BEGINNER-01. Map loose intents: "sleep more" → Sleep better, "be more active" → Move more, "eat healthier" → Eat better, "less stressed" → Reduce stress, "focus better" → Improve focus, "quit smoking/drinking/phone" → Break bad habits, "more organized" → Get more organized, "more energy" → Feel more energized.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'One of the eight fixed category labels.',
          enum: [
            'Sleep better',
            'Move more',
            'Eat better',
            'Feel more energized',
            'Reduce stress',
            'Improve focus',
            'Break bad habits',
            'Get more organized',
          ],
        },
      },
      required: ['category'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_goals',
    description:
      "Persist 1–2 goals on ONBOARD-BEGINNER-02. Do not wait for both — 1 is enough. Each string MUST be copied verbatim from the GOAL OPTIONS BY CATEGORY list for the user's chosen category (shown in the screen context). Never paraphrase, rename, or invent a goal label — non-matching strings are rejected.",
    parameters: {
      type: 'object',
      properties: {
        goals: {
          type: 'array',
          description: 'Array of 1-2 goal labels.',
          items: { type: 'string' },
        },
      },
      required: ['goals'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_habit',
    description:
      'Add or edit a habit on ONBOARD-BEGINNER-03. Supply defaults for fields the user did not specify: schedule="Weekday" (days=[1,2,3,4,5]), time="09:00", reminder=true. Call again with same name to edit. Server enforces max 2 habits — if you try a 3rd new habit the tool returns max_habits_reached.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Habit name, 1-100 chars.' },
        days: {
          type: 'array',
          description: 'Days of week as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        time: { type: 'string', description: 'Time of day in HH:MM 24-hour format.' },
        reminder: { type: 'boolean', description: 'Whether to enable a reminder notification.' },
        schedule: {
          type: 'string',
          description: 'Preset matching the days array.',
          enum: ['Weekday', 'Weekend', 'Every day'],
        },
      },
      required: ['name', 'days', 'time', 'reminder', 'schedule'],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_habit',
    description:
      'Remove a previously-added habit on ONBOARD-BEGINNER-03. Case-insensitive name match. Idempotent (returns ok even if the habit is absent).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the habit to remove.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_habit',
    description:
      'Edit an existing habit\'s schedule on the plan-review/confirm screen. Provide the habit `name` (case-insensitive) and ONLY the field(s) to change — time and/or days. Unspecified fields are PRESERVED (unlike add_habit, which resets them to defaults). Use when the user tweaks a habit they already added (e.g. "move meditation to 8am", "make running every day"). Fails if the habit isn\'t found.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the existing habit to edit (case-insensitive). 1-100 chars.',
        },
        days: {
          type: 'array',
          description: 'New days of week as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        time: { type: 'string', description: 'New time of day in HH:MM 24-hour format.' },
        reminder: { type: 'boolean', description: 'New reminder notification toggle.' },
        schedule: {
          type: 'string',
          description: 'New preset matching the days array.',
          enum: ['Weekday', 'Weekend', 'Every day'],
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_reflection_config',
    description:
      'Persist the evening reflection schedule on ONBOARD-BEGINNER-07. Fill missing fields with defaults: schedule="Weekday" (days=[1,2,3,4,5]), time="21:45", reminder=true.',
    parameters: {
      type: 'object',
      properties: {
        time: { type: 'string', description: 'HH:MM 24-hour format.' },
        days: {
          type: 'array',
          description: 'Days as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        reminder: { type: 'boolean', description: 'Reminder notification toggle.' },
        schedule: {
          type: 'string',
          description: 'Schedule preset matching the days array.',
          enum: ['Weekday', 'Weekend', 'Every day'],
        },
      },
      required: ['time', 'days', 'reminder', 'schedule'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_custom_prompts',
    description:
      "Persist the user's custom evening-reflection prompts on ONBOARD-ADV-CUSTOM. The prompts array REPLACES the saved set — always send the COMPLETE list the user currently wants, never just the newest one. Call the moment the user gives one or more prompts; do not confirm.",
    parameters: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          description:
            'The COMPLETE current list of custom reflection prompts (replaces the saved set).',
          items: { type: 'string' },
        },
      },
      required: ['prompts'],
      additionalProperties: false,
    },
  },
  {
    name: 'confirm_step_complete',
    description:
      'Signal that the user has explicitly affirmed they are done with the current step and want to move on (e.g. "yes", "move on", "next", "looks good"). The frontend uses this to advance. May be called in the same turn as a submit_*/add_habit/remove_habit tool. Never call if required fields for this screen are still missing.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            'Short telemetry-only note about why advance was called (e.g. "user affirmed recap").',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_brain_dump',
    description:
      "Persist the user's verbatim brain-dump text on ONBOARD-ADVANCED. Pass the FULL transcript — never summarize or rephrase.",
    parameters: {
      type: 'object',
      properties: {
        brain_dump_raw: {
          type: 'string',
          description: "User's verbatim brain-dump text. 10-5000 chars.",
        },
      },
      required: ['brain_dump_raw'],
      additionalProperties: false,
    },
  },
  {
    name: 'confirm_plan',
    description:
      'Complete onboarding from the plan-review screen (ONBOARD-BEGINNER-06 beginner / ONBOARD-ADVANCED-05 advanced). Call the moment the user confirms their starting plan and wants to begin ("looks good", "let\'s go", "start", "I\'m ready"). The frontend finishes onboarding and enters the app in response. Do not call before the plan-review screen.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Short telemetry-only note (e.g. "user said let\'s go").',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'ask_clarification',
    description:
      "Call this INSTEAD of committing data when the user's reply is ambiguous or they asked you something, and you can't yet map their answer to an option (e.g. on the path fork). Put your clarifying question in `message`, then ask it. Use this rather than free-texting so you never skip past a single-choice screen without resolving it.",
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Your clarifying question to ask the user. 1-300 chars.',
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
];
```
