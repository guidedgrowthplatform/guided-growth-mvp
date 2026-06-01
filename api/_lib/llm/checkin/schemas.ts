// Check-in tool schemas (HOME-CHECKIN). Mirrors onboarding; anon_id is injected
// server-side from the session, not from LLM args.

interface JSONSchemaProp {
  readonly type: 'string' | 'number' | 'boolean' | 'array';
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly items?: {
    readonly type: 'string' | 'number';
  };
}

interface JSONSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JSONSchemaProp>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
}

export type CheckinToolName =
  | 'create_habit'
  | 'complete_habit'
  | 'update_habit'
  | 'delete_habit'
  | 'create_metric'
  | 'log_metric'
  | 'delete_metric'
  | 'record_checkin'
  | 'start_focus'
  | 'query_habits'
  | 'get_summary'
  | 'suggest_habit';

export interface CheckinToolDefinition {
  readonly name: CheckinToolName;
  readonly description: string;
  readonly parameters: JSONSchema;
}

export const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekly', '3x/week'] as const;
export const INPUT_TYPE_OPTIONS = ['scale', 'binary', 'numeric', 'text'] as const;
export const HABIT_NAME_MAX_LEN = 100;

export const CHECKIN_TOOLS: readonly CheckinToolDefinition[] = [
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
          enum: [...FREQUENCY_OPTIONS],
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
          enum: [...FREQUENCY_OPTIONS],
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
          enum: [...INPUT_TYPE_OPTIONS],
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
] as const;

export const CHECKIN_TOOL_NAMES: ReadonlySet<string> = new Set(CHECKIN_TOOLS.map((t) => t.name));

export function isCheckinToolName(name: string): name is CheckinToolName {
  return CHECKIN_TOOL_NAMES.has(name);
}
