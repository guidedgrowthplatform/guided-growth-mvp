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
  | 'confirm_step_complete'
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
      'Persist the evening reflection schedule on ONBOARD-BEGINNER-07. Fill missing fields with defaults: schedule="Weekday" (days=[1,2,3,4,5]), time="21:45", reminder=true.',
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
    name: 'confirm_step_complete',
    description:
      'Signal that the user has explicitly affirmed they are done with the current step and want to move on (e.g. "yes", "move on", "next", "looks good"). The frontend uses this to advance. Never call on the same turn as a submit_*/add_habit/remove_habit tool. Never call if required fields for this screen are still missing.',
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
] as const;

export const ONBOARDING_TOOL_NAMES: ReadonlySet<string> = new Set(
  ONBOARDING_TOOLS.map((t) => t.name),
);

export function isOnboardingToolName(name: string): name is OnboardingToolName {
  return ONBOARDING_TOOL_NAMES.has(name);
}
