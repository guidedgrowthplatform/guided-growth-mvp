/**
 * Per-screen onboarding tool schemas. Vapi-agnostic.
 *
 * The sync layer (scripts/vapi-sync/) wraps these in Vapi's envelope at
 * registration time. Same definitions can be fed to any OpenAI-compatible
 * chat completions API if a non-voice path ever needs them.
 *
 * Adding a tool: append to ONBOARDING_TOOLS + add a handler in
 * api/_lib/vapi/handlers/. Run `npm run vapi:sync` to push to Vapi.
 *
 * Source of truth note: enum values here mirror the manual UI options in the
 * corresponding ONBOARD-* screen. Drift means voice and manual flows write
 * different shapes — keep them aligned with gg-spec packets.
 */

// Richer JSON-schema subset (array items, enums) than tools.ts's four base tools.
import type { JSONSchema } from './jsonSchemaTypes.js';

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
  | 'navigate_next'
  | 'confirm_plan';

/**
 * Vapi tool-lifecycle message. Vapi speaks these at fixed points around the
 * webhook round-trip, BEFORE the LLM resumes — they bridge the silence that
 * otherwise causes the model to pad with generic filler ("just a sec").
 *
 *  - request-start    → spoken the moment the tool call fires.
 *  - request-complete → spoken when the webhook returns success.
 *  - request-failed   → spoken when the webhook returns an `error` field.
 *
 * Keep these SHORT — they're heard on every call, so wordiness becomes
 * friction. Leaving a field unset lets the LLM's natural next utterance
 * (the screen's greeting / next prompt) fill that beat instead.
 */
export interface ToolLifecycleMessages {
  readonly requestStart?: string;
  readonly requestComplete?: string;
  readonly requestFailed?: string;
}

export interface OnboardingTool {
  readonly name: OnboardingToolName;
  readonly description: string;
  readonly parameters: JSONSchema;
  /** Canonical screen this tool services. Used by sync for grouping; Vapi never sees it. */
  readonly screen: string;
  /** Lifecycle messages threaded into Vapi's tool `messages` array. */
  readonly messages?: ToolLifecycleMessages;
}

// Closed enums mirror UI options on ONBOARD-01--FORM.
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

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
export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

export const SCHEDULE_OPTIONS = ['Weekday', 'Weekend', 'Every day'] as const;
export type ScheduleOption = (typeof SCHEDULE_OPTIONS)[number];

/**
 * Day-of-week sets per schedule preset (0 = Sunday). Mirror of the same map
 * in src/components/onboarding/constants.ts so frontend and backend write
 * identical {days, schedule} shapes.
 */
export const SCHEDULE_DAYS: Record<ScheduleOption, readonly number[]> = {
  Weekday: [1, 2, 3, 4, 5],
  Weekend: [0, 6],
  'Every day': [0, 1, 2, 3, 4, 5, 6],
};

/**
 * Reconcile a days array against the SchedulePicker presets. Returns the
 * matching preset label or null when `days` is a custom combination
 * (e.g. Mon/Wed/Fri). Handlers should run this AFTER validating days +
 * schedule independently and overwrite the persisted label with the inferred
 * one — that way `{days:[1,2,3,4,5], schedule:'Every day'}` (LLM drift)
 * lands as `{days:[1,2,3,4,5], schedule:'Weekday'}`, and PlanReviewPage's
 * formatCadence(days) is faithful without consulting schedule.
 */
export function inferSchedule(days: readonly number[]): ScheduleOption | null {
  const key = [...days].sort((a, b) => a - b).join(',');
  for (const opt of SCHEDULE_OPTIONS) {
    if ([...SCHEDULE_DAYS[opt]].sort((a, b) => a - b).join(',') === key) return opt;
  }
  return null;
}

export const PATH_OPTIONS = ['simple', 'braindump'] as const;
export type PathOption = (typeof PATH_OPTIONS)[number];

export const MAX_GOALS = 2;
export const MAX_HABITS = 2;

export const ONBOARDING_TOOLS: readonly OnboardingTool[] = [
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
          enum: [...GENDER_OPTIONS],
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
          enum: [...PATH_OPTIONS],
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
          enum: [...CATEGORY_OPTIONS],
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
          enum: [...SCHEDULE_OPTIONS],
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
          enum: [...SCHEDULE_OPTIONS],
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
      // Longer parse; tell the user we're working so the wait feels active
      // rather than dead air.
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
      'Advance the user to the next onboarding screen. This is the ONLY tool that moves the user between screens — the submit_* tools just save data, they do NOT navigate. ' +
      "When to call: only AFTER the user has explicitly confirmed they're ready to move on. Ask first ('ready to continue?' / 'anything else for this section?' / 'want to head to the next part?'). When they say yes, call this tool. " +
      'What to pass for target_step: the step number of the NEXT screen. From step-1 (profile) → 2. From step-2 (path choice) → 3. From step-3 (category/braindump) → 4. From step-4 (goals) → 5. From step-5 (habits) → 6. From step-6 (reflection) → 7. ' +
      "For users who back-navigated to edit an earlier screen: after they confirm 'go forward', call this with target_step = currentScreenStep + 1. They'll walk through the remaining screens one by one — that's intended. Do NOT pass target_step values that skip multiple screens at once. " +
      "Never call this without an explicit user confirmation. The user must say 'yes' / 'sure' / 'continue' / 'next' / equivalent.",
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
] as const;
