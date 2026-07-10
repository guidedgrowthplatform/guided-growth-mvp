/**
 * Per-beat tool schemas for The Weekly (weekly-checkin-v1). Vapi-agnostic.
 *
 * The Weekly runs on its OWN dedicated Vapi assistant, separate from the
 * onboarding assistant (approved decision, see gg-spec/docs/the-weekly.md).
 * Tool names are PREFIXED with `weekly_` so they never collide with the
 * onboarding tool names on dispatch (api/_lib/vapi/dispatch.ts routes by tool
 * name only, and both assistants' webhooks land on the same catch-all route).
 *
 * The sync layer (scripts/vapi-sync/) wraps these in Vapi's envelope at
 * registration time, exactly like tools.onboarding.ts.
 *
 * Adding a tool: append to WEEKLY_TOOLS + add a handler in
 * api/_lib/vapi/handlers/. Run `npm run vapi:sync` to push to Vapi (only
 * when VAPI_WEEKLY_ASSISTANT_ID is set, see scripts/vapi-sync/sync.ts).
 */
import type { JSONSchema } from './jsonSchemaTypes.js';

export type WeeklyToolName =
  | 'weekly_update_habit'
  | 'weekly_archive_habit'
  | 'weekly_add_habit'
  | 'weekly_complete'
  | 'weekly_advance';

// Re-export the lifecycle-message shape from the onboarding tools module so
// both tool sets share one type (they mean the same thing to Vapi).
export type { ToolLifecycleMessages } from './tools.onboarding.js';
import type { ToolLifecycleMessages } from './tools.onboarding.js';

export interface WeeklyTool {
  readonly name: WeeklyToolName;
  readonly description: string;
  readonly parameters: JSONSchema;
  /** Canonical beat this tool services. Used by sync for grouping; Vapi never sees it. */
  readonly screen: string;
  /** Lifecycle messages threaded into Vapi's tool `messages` array. */
  readonly messages?: ToolLifecycleMessages;
  /** Same non-blocking semantics as ONBOARDING_TOOLS, see tools.onboarding.ts. */
  readonly nonBlocking?: boolean;
}

// Mirrors the check-in tool schemas (create_habit/update_habit/schemas.ts)
// The Weekly writes to the same live, relational user_habits table.
export const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekly', '3x/week'] as const;
export type FrequencyOption = (typeof FREQUENCY_OPTIONS)[number];

export const HABIT_TYPE_OPTIONS = ['binary_do', 'binary_avoid'] as const;
export type HabitTypeOption = (typeof HABIT_TYPE_OPTIONS)[number];

export const HABIT_NAME_MAX_LEN = 100;

export const WEEKLY_TOOLS: readonly WeeklyTool[] = [
  {
    name: 'weekly_update_habit',
    screen: 'WCHECK-EDIT',
    description:
      'Edit an existing habit during The Weekly. This is the "minimize it" move: keep the ' +
      'habit but make it smaller. Renaming to a smaller bar (e.g. "Read a chapter" to ' +
      '"Read a page") or fewer days a week (frequency or schedule_days, e.g. five days a ' +
      'week becomes three, often the most useful lever) both minimize it. Also carries a ' +
      'timing change for the "change ' +
      'something in your life" move (the time field). Only call once the user has actually ' +
      'agreed to the change. Provide the habit `name` (case-insensitive, matches the current ' +
      'name) and ONLY the field(s) that are changing, unspecified fields are preserved. ' +
      "Fails if the habit isn't found under that name.",
    messages: {
      requestStart: '',
      requestFailed: '',
    },
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Current name of the habit to edit (case-insensitive). 1-100 chars.',
        },
        new_name: {
          type: 'string',
          description:
            'New name, if renaming (the minimize move, e.g. "Read a chapter" -> "Read a page"). 1-100 chars.',
        },
        frequency: {
          type: 'string',
          description: 'New frequency, if lowering (or changing) the cadence.',
          enum: [...FREQUENCY_OPTIONS],
        },
        schedule_days: {
          type: 'array',
          description: 'New explicit days of week as 0-6 ints, 0=Sunday, if changing which days.',
          items: { type: 'number' },
        },
        time: {
          type: 'string',
          description:
            'New time of day in HH:MM 24-hour format, if changing when it happens. Settle a ' +
            'CONCRETE time with the user first (e.g. "18:30"); never pass words like "evenings".',
        },
        reminder: {
          type: 'boolean',
          description: 'New reminder notification toggle, if changing.',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'weekly_archive_habit',
    screen: 'WCHECK-EDIT',
    description:
      'The "stop it" move: archive a habit that is not serving the user right now or is not ' +
      'the priority. This is a SOFT delete (is_active = false), habit history stays, ' +
      'nothing is hard-deleted. Only call once the user has actually agreed to stop the ' +
      "habit. Provide the habit's current `name` (case-insensitive). Fails if the habit " +
      "isn't found under that name.",
    messages: {
      requestStart: '',
      requestFailed: '',
    },
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the habit to archive (case-insensitive). 1-100 chars.',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'weekly_add_habit',
    screen: 'WCHECK-EDIT',
    description:
      'Add one small new habit. This is the exception, not the default: only call this when ' +
      'the week went well AND a state area (sleep, mood, energy, stress) is clearly low, and ' +
      'only ONE at most, never pile on. Only call once the user has actually agreed to add ' +
      "it. Pass canonical values, not the user's raw words.",
    messages: {
      requestStart: '',
      requestFailed: '',
    },
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Habit name, canonical form. 1-100 chars.',
        },
        frequency: {
          type: 'string',
          description: 'How often. Defaults to daily if unspecified.',
          enum: [...FREQUENCY_OPTIONS],
        },
        schedule_days: {
          type: 'array',
          description: 'Optional explicit days as 0-6 ints, 0=Sunday.',
          items: { type: 'number' },
        },
        habit_type: {
          type: 'string',
          description:
            'Polarity. Set "binary_avoid" for habits about NOT doing / quitting / reducing / ' +
            'avoiding something. Otherwise "binary_do" (default).',
          enum: [...HABIT_TYPE_OPTIONS],
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'weekly_complete',
    screen: 'WCHECK-CLOSE',
    description:
      "Lock next week's plan and close The Weekly session. Call once, at the close beat, " +
      'after the recap, this records the week (the focus set for next week, and the plan ' +
      'changes already made via weekly_update_habit / weekly_archive_habit / weekly_add_habit) ' +
      "so next week's session can reference it. Nothing has to change to call this, a good " +
      'week can close with the same plan and no focus.',
    messages: {
      requestStart: '',
      requestFailed: '',
    },
    parameters: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description: "The one focus set for next week, in the user's own terms. Optional.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'weekly_advance',
    screen: '*',
    nonBlocking: true,
    description:
      'Advance to the next beat of The Weekly session. Call once the current beat is done ' +
      '(the user has nothing more to add) and you are ready to move on.',
    messages: {
      requestStart: '',
      requestFailed: '',
    },
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
] as const;
