// Onboarding tool schemas — fed to OpenAI Responses API for ONBOARD-* screens.
// Mirrors path-1 Vapi tool set; anon_id is omitted because path-3 injects it
// from the authenticated session, not from LLM args.
import type { JSONSchema } from '../jsonSchemaTypes.js';

export type OnboardingToolName =
  | 'submit_profile'
  | 'submit_path_choice'
  | 'submit_category'
  | 'submit_goals'
  | 'add_habit'
  | 'remove_habit'
  | 'update_habit'
  | 'submit_reflection_config'
  | 'submit_custom_prompts'
  | 'submit_brain_dump'
  | 'advance_step'
  | 'confirm_plan'
  | 'ask_clarification';

export interface OnboardingToolDefinition {
  readonly name: OnboardingToolName;
  readonly description: string;
  readonly parameters: JSONSchema;
}

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export const CATEGORY_OPTIONS = [
  'Sleep better',
  'Move more',
  'Eat better',
  'Feel more energized',
  'Reduce stress',
  'Improve focus',
  'Break bad habits',
  'Get more organized',
] as const;
export const SCHEDULE_OPTIONS = ['Weekday', 'Weekend', 'Every day'] as const;
export const PATH_OPTIONS = ['simple', 'braindump'] as const;

export const MAX_GOALS = 2;
export const MAX_HABITS = 2;
export const AGE_MIN = 13;
export const AGE_MAX = 120;

// Direct-LLM counterpart of the Vapi tools in api/_lib/llm/tools.onboarding.ts.
// Keep required-arrays / enums in sync when either side changes.
export const ONBOARDING_TOOLS: readonly OnboardingToolDefinition[] = [
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
          enum: [...GENDER_OPTIONS],
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
          enum: [...PATH_OPTIONS],
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
          enum: [...CATEGORY_OPTIONS],
        },
      },
      required: ['category'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_goals',
    description:
      "Persist the user's COMPLETE subcategory selection (1–2 subcategories) on ONBOARD-BEGINNER-02. This REPLACES the prior save, so EVERY call MUST include ALL subcategories the user currently wants — not just the newest one. Do not wait for both — 1 is enough to call. Each string MUST be copied verbatim from the Subcategory Options list for the user's chosen category (shown in the screen context). Never paraphrase, rename, or invent a subcategory label — non-matching strings are rejected.",
    parameters: {
      type: 'object',
      properties: {
        goals: {
          type: 'array',
          description: 'Array of 1-2 subcategory labels.',
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
      'Add or edit a habit on ONBOARD-BEGINNER-03. ' +
      'ONE HABIT AT A TIME — STRICT (habits-ACROSS, not fields-WITHIN): even if the user names two habits in one breath ("walking and meditation"), capture and FULLY configure habit #1 (pick + days + time + reminder) BEFORE you call add_habit for habit #2. Do not batch picks with defaults and then come back to configure them. ' +
      'WITHIN a single habit, batch-parsing a full sentence is fine — "walking every day at 9:30 PM with a reminder" → add_habit(name="Walking", days=[0,1,2,3,4,5,6], time="21:30", reminder=true, schedule="Every day") in one call. ' +
      'TWO-CALL CONFIGURATION PATTERN per habit (when the user did NOT pre-state the schedule): (1) call add_habit(name=<exact label>) — records the pick with server defaults. (2) Ask the user for days, time, reminder — one short question at a time, waiting for each answer. (3) Call add_habit AGAIN with the same name plus the full schedule. Server merges by name. (4) THEN move to habit #2 if any. ' +
      'Only `name` is required by the tool, but a habit is not "configured" until you have asked the user for days + time + reminder. Server enforces max 2 habits.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Habit name, 1-100 chars.',
        },
        days: {
          type: 'array',
          description: 'Days of week as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        time: {
          type: 'string',
          description: 'Time of day in HH:MM 24-hour format.',
        },
        reminder: {
          type: 'boolean',
          description: 'Whether to enable a reminder notification.',
        },
        schedule: {
          type: 'string',
          description: 'Preset matching the days array.',
          enum: [...SCHEDULE_OPTIONS],
        },
        habit_type: {
          type: 'string',
          description:
            'Polarity. Set "binary_avoid" for habits about NOT doing / quitting / reducing / avoiding something (e.g. "No caffeine after 2 PM", "No screens after 10 PM", "stop smoking"). Otherwise "binary_do" (default). Include it on EVERY add_habit call for the same habit (alongside name) so it persists across the two-call config pattern.',
          enum: ['binary_do', 'binary_avoid'],
        },
      },
      required: ['name'],
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
        name: {
          type: 'string',
          description: 'Name of the habit to remove.',
        },
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
        time: {
          type: 'string',
          description: 'New time of day in HH:MM 24-hour format.',
        },
        reminder: {
          type: 'boolean',
          description: 'New reminder notification toggle.',
        },
        schedule: {
          type: 'string',
          description: 'New preset matching the days array.',
          enum: [...SCHEDULE_OPTIONS],
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_reflection_config',
    description:
      "Persist the user's evening reflection schedule on ONBOARD-BEGINNER-07. " +
      'PRECONDITION: do NOT call this until the user has actually answered when they want their reflection. The reflection schedule is the user\'s choice — do NOT pre-fill defaults silently just to advance. If the user has not given you a time yet, ASK FIRST (e.g. "When would you like to do your daily reflection?"). ' +
      'ALL FOUR FIELDS ARE REQUIRED by the server: `time` (HH:MM), `days` (array of 0-6 ints), `reminder` (boolean), `schedule` (Weekday | Weekend | Every day). Once the user gives a time, infer the remaining fields from natural defaults (Weekday + reminder on) and call. ' +
      'If the user says "whatever you think" / "default is fine", first ask once more ("What time works for you usually?"). If they still decline, pick 21:00 BUT tell them explicitly ("I\'ll set 9 PM — you can change it later in Settings") before calling — do NOT silently default.',
    parameters: {
      type: 'object',
      properties: {
        time: {
          type: 'string',
          description: 'HH:MM 24-hour format.',
        },
        days: {
          type: 'array',
          description: 'Days as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        reminder: {
          type: 'boolean',
          description: 'Reminder notification toggle.',
        },
        schedule: {
          type: 'string',
          description: 'Schedule preset matching the days array.',
          enum: [...SCHEDULE_OPTIONS],
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
    name: 'advance_step',
    description:
      'Advance the user to the next onboarding screen. This is the ONLY tool that moves between screens — the submit_*/add_habit tools just save data, they do NOT navigate. ' +
      'ABSOLUTE LAW: call advance_step in the SAME TURN as the data tool, chained right after it. After you call submit_profile / submit_path_choice / submit_category / submit_goals / submit_reflection_config / submit_custom_prompts / submit_brain_dump, you MUST also call advance_step. The data tool firing IS the confirmation — do NOT ask "ready?" / "anything else?" first. ' +
      'target_step = the NEXT screen step: step-1 (profile) → 2, step-2 (path) → 3, step-3 (category/braindump) → 4, step-4 (goals) → 5, step-5 (habits) → 6, step-6 (reflection) → 7. Never skip multiple steps at once. ' +
      'HABITS CARVE-OUT (step 5): do NOT call advance_step(6) until EVERY picked habit has its days + time + reminder configured (see add_habit two-call pattern). ' +
      "The backend rejects advances that skip steps or that fire before the source screen's data is saved — if rejected, call the screen's data tool first, then advance_step again.",
    parameters: {
      type: 'object',
      properties: {
        target_step: {
          type: 'number',
          description:
            'The step number of the NEXT screen (integer 1–10). Usually currentScreenStep + 1.',
        },
      },
      required: ['target_step'],
      additionalProperties: false,
    },
  },
  {
    name: 'confirm_plan',
    description:
      'Complete onboarding from the FINAL plan-review screen (ONBOARD-BEGINNER-06 beginner / ONBOARD-ADVANCED-05 advanced). ' +
      'STRICT PRECONDITION: only call when the user is ON the plan-review screen AND habits + reflection are BOTH already saved. If the screen context says step 5 (habits) or step 6 (reflection), you have NOT finished setup — finish that screen first. ' +
      'Call the moment the user, ON THE PLAN-REVIEW SCREEN, confirms ("looks good", "let\'s go", "start", "I\'m ready"). The frontend finishes onboarding and enters the app in response. ' +
      "If the backend returns confirm_plan_too_early, do NOT retry — call the suggested advance_step (or the screen's primary data tool) instead and let the user walk through the remaining screen.",
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
] as const;

export const ONBOARDING_TOOL_NAMES: ReadonlySet<string> = new Set(
  ONBOARDING_TOOLS.map((t) => t.name),
);

export function isOnboardingToolName(name: string): name is OnboardingToolName {
  return ONBOARDING_TOOL_NAMES.has(name);
}
