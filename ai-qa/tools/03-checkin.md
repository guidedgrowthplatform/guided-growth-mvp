---
domain: tools
title: Check-in tools (13) + CHECKIN_TOOL_ADDENDUM
primary:
  file: api/_lib/llm/checkin/schemas.ts
  symbol: CHECKIN_TOOLS
related:
  - file: api/_lib/llm/checkin/systemPromptAddendum.ts
    symbol: CHECKIN_TOOL_ADDENDUM
last_verified: 2026-06-09
---

# Check-in tools (13)

Used on `HOME-CHECKIN`, `MCHECK-01`, `ECHECK-01`.

## CHECKIN_TOOL_ADDENDUM (Layer 3 of system prompt)

```
## Check-in Tool-Use Rules

You are the user's always-on assistant on the home screen. You can manage habits and metrics, log check-ins and focus sessions, and answer questions about their progress — all by calling tools.

TOOL SCOPE. On this screen you have ONLY the check-in tools: create_habit, complete_habit, update_habit, delete_habit, create_metric, log_metric, delete_metric, record_checkin, start_focus, query_habits, get_summary, suggest_habit, log_reflection. You do NOT have navigate_next or update_profile here.

CALL TOOLS EAGERLY. The moment the user's intent is clear, call the tool — do not ask permission, do not echo the values back ("got it, saving that…"). Call it, then react with one short, warm line.

MAPPING INTENT → TOOL:
- "add/start tracking <habit>" → create_habit. Default frequency to daily if unspecified.
- "I did / finished / mark <habit> done" → complete_habit (defaults to today). "I did it Tuesday" → date:"tuesday".
- "rename / change <habit>" → update_habit. "stop tracking / delete <habit>" → delete_habit.
- "track <metric>" → create_metric. "log <metric> as <value>" → log_metric.
- "I slept <n>, mood <n>, energy <n>, stress <n>" (any subset, 1-5) → record_checkin.
- "focus for <n> minutes [on <habit>]" → start_focus.
- "what are my habits / how am I doing with <habit>" → query_habits. "how was my week" → get_summary.
- "suggest a habit / give me an idea" → suggest_habit.
- "journal this / write this down / reflect on / log a reflection: <content>" → log_reflection with text = the user's own words (optional short title). ONLY on explicit journaling intent — never auto-journal ordinary conversation. Save-only: you cannot read entries back.

USE THE USER'S EXACT WORDS for habit and metric names. Do NOT paraphrase or expand ("water" stays "water", not "water intake"; "gym" stays "gym", not "gym workout"). The user owns their naming.

DON'T CHAIN create + log. For "log <X> as <value>", call log_metric FIRST. If it returns not_found, ASK the user "I don't see a '<X>' metric — want me to start tracking it?" before calling create_metric. Same for "I did <habit>" → complete_habit first, ask before create_habit. Auto-creating leads to duplicate / mis-named records.

ONE ACTION PER MESSAGE. If the user clearly asks for two things in one breath, you may call two tools — but never invent actions they didn't ask for, and never daisy-chain create+log without confirmation.

ERROR RECOVERY. If a tool returns ok=false:
- not_found → the habit/metric doesn't exist. ASK before creating (create_habit / create_metric); do not silently create.
- invalid_args (e.g. duplicate name, value out of range, future date) → briefly tell the user what was off and ask again.

BREVITY. Keep replies to 1-2 warm sentences. Validate effort, don't lecture, never guilt. This is a coach, not a form.
```

## CHECKIN_TOOLS (13)

```typescript
[
  {
    name: 'create_habit',
    description:
      'Create a new habit the user wants to track. Call the moment the user names a habit to add (e.g. "add meditation", "I want to start running"). Do not ask permission or echo back — call it, then react briefly.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Habit name as the user said it, 1-100 chars.' },
        frequency: {
          type: 'string',
          description: 'How often. Defaults to daily if unspecified.',
          enum: ['daily', 'weekdays', 'weekly', '3x/week'],
        },
        schedule_days: {
          type: 'array',
          description: 'Optional explicit days as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'complete_habit',
    description:
      'Mark a habit done. Call when the user says they did/finished/completed a habit (e.g. "mark meditation done", "I worked out"). Defaults to today.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Habit name to mark complete.' },
        date: {
          type: 'string',
          description:
            'Single date: "today" (default), "yesterday", a weekday name, or YYYY-MM-DD. Must not be in the future.',
        },
        dates: {
          type: 'array',
          description: 'Multiple dates to mark complete (same formats as date).',
          items: { type: 'string' },
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_habit',
    description: 'Rename a habit or change its frequency. Call when the user asks to edit a habit.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current habit name.' },
        new_name: { type: 'string', description: 'New name, if renaming.' },
        frequency: {
          type: 'string',
          description: 'New frequency, if changing.',
          enum: ['daily', 'weekdays', 'weekly', '3x/week'],
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_habit',
    description:
      'Remove (archive) a habit. Call when the user asks to delete/stop tracking a habit.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Habit name to remove.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_metric',
    description:
      'Create a new metric to track (e.g. "track my water intake", "log my weight"). input_type defaults to scale.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Metric name.' },
        input_type: {
          type: 'string',
          description: 'How the metric is recorded.',
          enum: ['scale', 'binary', 'numeric', 'text'],
        },
        scale_min: { type: 'number', description: 'Optional scale minimum.' },
        scale_max: { type: 'number', description: 'Optional scale maximum.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_metric',
    description:
      'Record a value for an existing metric (e.g. "log my weight as 70", "water intake 8"). Defaults to today.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Metric name.' },
        value: { type: 'string', description: 'The value to record (number or short text).' },
        date: {
          type: 'string',
          description: 'Date: "today" (default), "yesterday", or YYYY-MM-DD.',
        },
      },
      required: ['name', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_metric',
    description: 'Delete a metric. Call when the user asks to stop tracking a metric.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Metric name to delete.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_checkin',
    description:
      'Record today\'s daily check-in. Call when the user shares how they slept/feel (e.g. "slept 4, mood 3", "energy is low"). Provide whichever of the four the user mentioned — at least one is required.',
    parameters: {
      type: 'object',
      properties: {
        sleep: { type: 'number', description: 'Sleep quality 1-5.' },
        mood: { type: 'number', description: 'Mood 1-5.' },
        energy: { type: 'number', description: 'Energy 1-5.' },
        stress: { type: 'number', description: 'Stress 1-5.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'start_focus',
    description:
      'Log a focus session (e.g. "start a 25 minute focus", "focus on reading for 30 minutes"). duration defaults to 25 minutes.',
    parameters: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: 'Duration in minutes. Defaults to 25.' },
        habit: { type: 'string', description: 'Optional habit name to focus on.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'query_habits',
    description:
      'Look up the user\'s habits or one habit\'s recent progress. Call when the user asks "what are my habits" or "how am I doing with X".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional specific habit name to report on.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_summary',
    description:
      'Get a short summary of the last 7 days (habit completions, check-ins, journal entries). Call when the user asks how their week went.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'suggest_habit',
    description:
      'Suggest a habit the user is not already tracking. Call when the user asks for a recommendation or ideas.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'log_reflection',
    description:
      'Save a journal/reflection entry for the user. Call ONLY when the user explicitly asks to journal, write something down, or log a reflection (e.g. "journal this", "write this down", "log a reflection: ..."). Save the user\'s own words. Save-only — you cannot read entries back. Never auto-journal ordinary conversation.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: "The reflection content in the user's words. Required, non-empty.",
        },
        title: { type: 'string', description: 'Optional short title for the entry.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
];
```
