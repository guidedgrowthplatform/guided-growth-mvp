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
  | 'submit_morning_checkin'
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
  /**
   * Pure data-save whose result the assistant does NOT need to speak. When true,
   * the Vapi sync marks the tool `async: true`, so Vapi resumes the model the
   * instant the call fires instead of waiting for the webhook + DB write. This
   * removes the tool round-trip from the spoken latency (the ~4.5s/turn finding):
   * the coach speaks now, the save lands in the background.
   *
   * Leave UNSET for result-dependent tools the assistant must hear back from:
   * add_habit (max_habits_reached), update_habit (not_found), navigate_next
   * (load-bearing screen change), confirm_plan (completes onboarding). Those
   * stay blocking so the model reacts to the real outcome.
   */
  readonly nonBlocking?: boolean;
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
    nonBlocking: true,
    description:
      "Save profile fields (nickname, age, gender, referral source) to the database. DATA ONLY — this tool does NOT advance the user to the next screen. Use `navigate_next` for that, AFTER the user confirms they're ready. AUTO-CALL IMMEDIATELY the moment the user states any of these fields. Do not ask for permission. Do not summarize. Edit mode: re-call with only the field(s) the user is updating — never re-send unchanged values. Only include fields the user explicitly stated; never invent values. At least one field is required per call.",
    messages: {
      requestStart: '',
      requestFailed: '',
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
    nonBlocking: true,
    description:
      'Save the user\'s chosen onboarding path (simple vs braindump). DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user signals their choice. Phrases like "I\'m new", "this is my first time" → simple. "I already have habits", "I know what I want to work on" → braindump. Do not ask for permission to save — just call.',
    messages: {
      requestStart: '',
      requestFailed: '',
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
    nonBlocking: true,
    description:
      'Save the user\'s chosen category. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user names an improvement area, even loosely. Map to the closest of the 8 categories: "sleep more" → Sleep better, "be more active" → Move more, "eat healthier" → Eat better, "less stressed" → Reduce stress, "focus better" → Improve focus, "quit smoking/drinking/phone" → Break bad habits, "more organized/on top of things" → Get more organized, "more energy" → Feel more energized. Do not ask for permission — just call.',
    messages: {
      requestStart: '',
      requestFailed: '',
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
    nonBlocking: true,
    description:
      "Save the user's COMPLETE goal selection for this screen (1 or 2 goals). This REPLACES whatever was saved before, so EVERY call MUST include ALL goals the user currently wants — never just the newest one. If they pick one goal now and add a second later, call again with BOTH goals in the array. If they change their mind, call again with only the goals they now want. DATA ONLY — does NOT advance to the next screen; use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY when the user names a goal — do not ask permission. Goal labels must match the on-screen options exactly.",
    messages: {
      requestStart: '',
      requestFailed: '',
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
      "Add (or edit) a habit. DATA ONLY — does NOT advance to the next screen. Use `navigate_next(target_step=6)` ONLY after every picked habit has been FULLY configured with the user's schedule. " +
      'ONE HABIT AT A TIME — STRICT (this rule is about habits-ACROSS, not fields-WITHIN): ' +
      'Even if the user names two habits in the same breath ("walking and meditation"), you process them SEQUENTIALLY. Capture pick #1, fully configure pick #1, THEN move to pick #2. Do NOT call add_habit for pick #2 until pick #1 has its days + time + reminder all asked-and-set. ' +
      'WITHIN a single habit, batch-parsing a full sentence is fine — "walking every day at 9:30 PM with a reminder" can become add_habit(name="Walking", days=[0,1,2,3,4,5,6], time="21:30", reminder=true, schedule="Every day") in one call. The three-questions pattern below is only for when the user did NOT pre-state the schedule. ' +
      'TWO-CALL CONFIGURATION PATTERN (per habit): ' +
      '(1) Call add_habit(name="<exact label>") — records the pick with server defaults (Weekday days, 09:00 time, reminder on). ' +
      '(2) Then ask the user three short questions, ONE AT A TIME: how often (daily/weekdays/weekends/specific days), what time, and whether they want a reminder. WAIT for each answer before asking the next. ' +
      '(3) Call add_habit AGAIN with the SAME name plus the configured fields: add_habit(name="<same>", days=[...], time="HH:MM", reminder=<bool>, schedule="Weekday"|"Weekend"|"Every day"). The server merges by name — this second call updates the same habit. ' +
      '(4) Only NOW move to the next habit pick (if any). Repeat the full two-call sequence for it. ' +
      'Only after EVERY picked habit has its days + time + reminder asked-and-set should you call navigate_next(target_step=6). ' +
      'Server enforces a max of 2 habits — if you try a 3rd new habit the tool returns max_habits_reached and you should tell the user to remove one first. ' +
      'On step 5 (ONBOARD-BEGINNER-03), use add_habit for BOTH create AND edit. Do NOT use update_habit here — update_habit is for the final plan-review screen (step 7) only.',
    messages: {
      requestStart: '',
      requestFailed: '',
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
    screen: 'ONBOARD-BEGINNER-03',
    nonBlocking: true,
    description:
      'Remove a previously-added habit. DATA ONLY — does NOT advance to the next screen. AUTO-CALL IMMEDIATELY the moment the user asks to drop a habit ("remove the walking one", "scratch that", "no longer caffeine"). Name match is case-insensitive. Do not ask for permission — just call.',
    messages: {
      requestStart: '',
      requestFailed: '',
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
      requestStart: '',
      requestFailed: '',
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
    nonBlocking: true,
    description:
      "Save the user's evening reflection schedule. DATA ONLY — does NOT advance to the next screen. Use `navigate_next(target_step=10)` AFTER this returns. " +
      'PRECONDITION: do NOT call this until the user has actually answered when they want their reflection. ' +
      "ALL FOUR FIELDS ARE REQUIRED by the server: `time` (HH:MM), `days` (array of 0-6 ints), `reminder` (boolean), `schedule` (Weekday | Weekend | Every day). If the user has not yet said a time, ASK FIRST — do NOT pre-fill defaults silently and fire this tool. The reflection screen is the user's choice; do not bypass it. " +
      'Once the user gives you a time (e.g. "around 9 PM" → time="21:00", or "9:45 PM" → "21:45"), infer the missing fields from natural defaults (Weekday + reminder on) and call. Then chain navigate_next(target_step=10) in the same turn.',
    messages: {
      requestStart: '',
      requestFailed: '',
    },
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
        mode: {
          type: 'string',
          description:
            "How the user wants to reflect. 'prompts' = answer questions (guided default or custom); 'freeform' = no questions, just talk freely. Include 'freeform' when the user says they want to talk freely / no questions. Omit (defaults to prompts) for guided.",
          enum: ['prompts', 'freeform'],
        },
      },
      required: ['time', 'days', 'reminder', 'schedule'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_morning_checkin',
    screen: 'ONBOARD-MORNING-SETUP',
    description:
      "Save the user's morning check-in schedule. DATA ONLY — does NOT advance to the next screen; chain navigate_next(target_step=9) AFTER this returns, in the same turn. " +
      'PRECONDITION: do NOT call this until the user has actually answered when they want their morning check-in. ' +
      "ALL FOUR FIELDS ARE REQUIRED by the server: `time` (HH:MM), `days` (array of 0-6 ints), `reminder` (boolean), `schedule` (Weekday | Weekend | Every day). If the user has not yet said a time, ASK FIRST — do NOT pre-fill defaults silently and fire this tool. The morning-setup screen is the user's choice; do not bypass it. " +
      'Once the user gives a time (e.g. "around 7:30 in the morning" → time="07:30"), infer the missing fields from natural defaults (Weekday + reminder on) and call. Then chain navigate_next(target_step=9) in the same turn.',
    messages: {
      requestStart: '',
      requestFailed: '',
    },
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
    screen: 'ONBOARD-ADV-CUSTOM',
    nonBlocking: true,
    description:
      "Save the user's custom evening-reflection prompts. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user gives one or more prompts. The prompts array REPLACES the saved set — always send the COMPLETE current list the user wants, never just the newest one (if they had two and add a third, send all three). Do not ask for permission — just call.",
    messages: {
      requestStart: '',
      requestFailed: '',
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
    nonBlocking: true,
    description:
      "Save the user's verbatim brain-dump text. DATA ONLY — does NOT advance to the next screen. Use `navigate_next` for that, after the user confirms. AUTO-CALL IMMEDIATELY the moment the user finishes describing what they want to work on (after a natural pause of a sentence or two). Pass the FULL transcript verbatim — never summarize, never rephrase, never paraphrase. Server parses this. Do not ask for permission — just call.",
    messages: {
      requestStart: '',
      requestFailed: '',
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
      'Advance the user to the next onboarding screen. This is the ONLY tool that moves the user between screens — the submit_* / add_* tools just save data, they do NOT navigate. ' +
      'ABSOLUTE LAW: navigate_next MUST be called in the SAME TURN as the data tool. Whenever you call submit_profile / submit_path_choice / submit_category / submit_goals / add_habit / submit_reflection_config / submit_morning_checkin / submit_custom_prompts / submit_brain_dump, you MUST chain navigate_next right after, in the same response. If you finished a turn that called a data tool but did NOT call navigate_next, you have a critical bug — the user is now stuck and will have to remind you. Do not let this happen. ' +
      'NEVER ask the user "are you ready?" / "anything else?" / "want to continue?" / "ready to move on?" before navigating. The data tool firing IS the confirmation. The user does not know navigate_next exists; they expect screens to advance based on what they said. ' +
      "GOOD: User says 'I want walking 3 times a week at 8pm with reminders'. You call: add_habit(name='Walking', days=[1,3,5], time='20:00', reminder=true), THEN navigate_next(target_step=6). One turn, two tool calls. " +
      "BAD: User says the same thing. You call: add_habit(...), then say 'Walking, three days a week at 8 PM. Anything else?'. This is a BUG. You FAILED to call navigate_next. The user now has to say 'continue' to unstick. " +
      'What to pass for target_step: the step number of the NEXT screen. From step-1 (profile) → 2. step-2 (path) → 3. step-3 (category/braindump) → 4. step-4 (goals) → 5. step-5 (habit-select) → 6. step-6 (habit-schedule) → 7. step-7 (plan-review) → 8. step-8 (morning) → 9. step-9 (reflection) → 10. ' +
      "For users who back-navigated to edit an earlier screen: after they re-confirm the edit, call this with target_step = currentScreenStep + 1. They'll walk through the remaining screens one by one — that's intended. Do NOT pass target_step values that skip multiple screens at once. " +
      'Only exception: if the user EXPLICITLY signals MORE input is coming BEFORE you call the data tool (e.g. "wait, one more habit", "and another goal"), capture that input first. Once you call the data tool, navigate_next MUST follow in the same turn.',
    messages: {
      requestStart: '',
      requestFailed: '',
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
      'Complete onboarding from the FINAL plan-review screen. ' +
      'STRICT PRECONDITION: only call when current_step >= 7. If current_step is 5 or 6, you have NOT finished setup — call navigate_next(target_step = current_step + 1) instead. ' +
      'The plan-review screen shows the user their final plan after habits AND reflection are both saved. It is NOT the step-5 review-habits sub-phase (which also displays habits but precedes the reflection step). ' +
      'Call the moment the user, ON THE PLAN-REVIEW SCREEN, confirms they want to begin ("looks good", "let\'s go", "start", "I\'m ready"). The frontend finishes onboarding and enters the app in response. ' +
      'If the backend returns confirm_plan_too_early, do NOT retry — call the suggested navigate_next instead.',
    messages: {
      requestStart: '',
      requestFailed: '',
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
