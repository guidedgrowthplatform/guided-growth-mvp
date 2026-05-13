/**
 * P1-07 — Agent Tool Definitions.
 *
 * Single source of truth for the four LLM tools shared by Vapi (Path 1) and
 * Direct LLM (Path 3). TOOL_DEFINITIONS is the wire artifact (paste into Vapi
 * dashboard, attach to LLM tool_choice). dispatchToolCall is the runtime
 * entrypoint both paths route through, so handler behavior cannot diverge
 * across channels.
 *
 * Adding a new tool: extend TOOL_DEFINITIONS, add a TOOL_HANDLERS entry, add
 * tests in __tests__/tools.test.ts. The snapshot test will fail until the new
 * shape is reviewed — that's intentional.
 */
import pool from '../db.js';
import { isSessionLogEvent } from '../session-log-events.js';

// JSON Schema (Vapi + OpenAI-compatible shape).
interface JSONSchemaObject {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JSONSchemaProp>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
}
interface JSONSchemaProp {
  readonly type: 'string' | 'object';
  readonly description?: string;
  readonly enum?: readonly string[];
}
interface ToolDefinition {
  readonly name: ToolName;
  readonly description: string;
  readonly parameters: JSONSchemaObject;
}

export type ToolName = 'get_user_context' | 'update_profile' | 'navigate_next' | 'log_event';

export const UPDATE_PROFILE_FIELDS = [
  'name',
  'nickname',
  'age_group',
  'gender',
  'referral_source',
] as const;
export type UpdateProfileField = (typeof UPDATE_PROFILE_FIELDS)[number];

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'get_user_context',
    description:
      'Fetch the static context block for the screen the user is on. Returns the screen prompt the LLM should orient around. Call once per screen.',
    parameters: {
      type: 'object',
      properties: {
        screen_id: {
          type: 'string',
          description: 'Canonical screen ID, e.g. HOME-FIRST, MCHECK-01, ONBOARD-WELCOME.',
        },
      },
      required: ['screen_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_profile',
    description:
      'Write a single profile field the user volunteered. Use only for the whitelisted fields. Never invent values — only persist what the user actually said.',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          description: 'Profile field to update. Must be one of the whitelisted values.',
          enum: [...UPDATE_PROFILE_FIELDS],
        },
        value: {
          type: 'string',
          description: 'The value to write. Must be a non-empty string.',
        },
      },
      required: ['field', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'navigate_next',
    description:
      'Request that the client navigate to a specific screen. Writes a navigate row to session_log; the client picks up the event via the WebRTC data channel and performs the actual route change.',
    parameters: {
      type: 'object',
      properties: {
        target_screen: {
          type: 'string',
          description: 'Canonical screen ID to navigate to.',
        },
      },
      required: ['target_screen'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_event',
    description:
      'Append a row to session_log so the next callLLM picks up the state delta. event_name must be one of the canonical session_log events (past-tense / state-noun, see migration 017).',
    parameters: {
      type: 'object',
      properties: {
        event_name: {
          type: 'string',
          description: 'Canonical session_log event name. Rejected if not in the whitelist.',
        },
        properties: {
          type: 'object',
          description: 'Optional structured payload merged into session_log.payload.',
        },
      },
      required: ['event_name'],
      additionalProperties: false,
    },
  },
] as const;

export interface ToolContext {
  user_id: string;
  session_id: string;
}

export type ToolError = 'unknown_tool' | 'invalid_args' | 'not_found' | 'handler_error';
export type ToolResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: ToolError; message?: string };

function invalid(message: string): ToolResult {
  return { ok: false, error: 'invalid_args', message };
}

function getString(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === 'string' ? v : null;
}

const SCREEN_ID_MAX_LEN = 200;
const NICKNAME_REGEX = /^[a-zA-Z0-9_]*$/;
const PROFILE_FIELD_MAX_LEN: Record<UpdateProfileField, number> = {
  name: 100,
  nickname: 50,
  age_group: 50,
  gender: 50,
  referral_source: 50,
};

async function getUserContext(
  _ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const screenId = getString(args, 'screen_id')?.trim();
  if (!screenId) return invalid('screen_id is required');
  if (screenId.length > SCREEN_ID_MAX_LEN) return invalid('screen_id is too long');

  const result = await pool.query<{ context_block: string; version: number }>(
    `SELECT context_block, version FROM screen_contexts WHERE screen_id = $1`,
    [screenId],
  );
  if (result.rowCount === 0) {
    return { ok: false, error: 'not_found', message: `Unknown screen_id: ${screenId}` };
  }
  const row = result.rows[0];
  return {
    ok: true,
    result: {
      screen_id: screenId,
      context_block: row.context_block,
      version: row.version,
    },
  };
}

function isProfileField(v: unknown): v is UpdateProfileField {
  return typeof v === 'string' && (UPDATE_PROFILE_FIELDS as readonly string[]).includes(v);
}

async function updateProfile(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const field = args.field;
  const value = args.value;
  if (!isProfileField(field)) return invalid('field must be one of the whitelisted values');
  if (typeof value !== 'string' || value.length === 0)
    return invalid('value must be a non-empty string');
  if (value.length > PROFILE_FIELD_MAX_LEN[field]) {
    return invalid(`value exceeds ${PROFILE_FIELD_MAX_LEN[field]} characters`);
  }
  if (field === 'nickname' && !NICKNAME_REGEX.test(value)) {
    return invalid('nickname may only contain letters, numbers, and underscores');
  }
  if (field === 'name' && value.trim().length === 0) {
    return invalid('name must not be whitespace-only');
  }

  // Column name comes from a hard-coded whitelist — safe to interpolate.
  await pool.query(`UPDATE profiles SET ${field} = $2 WHERE id = $1`, [ctx.user_id, value]);

  return { ok: true, result: { field, value } };
}

async function navigateNext(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const targetScreen = getString(args, 'target_screen')?.trim();
  if (!targetScreen) return invalid('target_screen is required');
  if (targetScreen.length > SCREEN_ID_MAX_LEN) return invalid('target_screen is too long');

  const result = await pool.query<{ id: string; timestamp: Date }>(
    `INSERT INTO session_log (user_id, session_id, event_type, screen_id, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, timestamp`,
    [
      ctx.user_id,
      ctx.session_id,
      'navigate',
      null,
      { source: 'llm_tool', target_screen: targetScreen },
    ],
  );
  return {
    ok: true,
    result: {
      logged: true,
      session_log_id: result.rows[0].id,
      target_screen: targetScreen,
    },
  };
}

async function logEvent(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const eventName = args.event_name;
  if (!isSessionLogEvent(eventName))
    return invalid('event_name is not a canonical session_log event');

  let payload: Record<string, unknown> | null = null;
  if (args.properties !== undefined) {
    if (
      typeof args.properties !== 'object' ||
      args.properties === null ||
      Array.isArray(args.properties)
    ) {
      return invalid('properties must be an object');
    }
    payload = args.properties as Record<string, unknown>;
  }

  const result = await pool.query<{ id: string; timestamp: Date }>(
    `INSERT INTO session_log (user_id, session_id, event_type, screen_id, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, timestamp`,
    [ctx.user_id, ctx.session_id, eventName, null, payload],
  );
  return {
    ok: true,
    result: { logged: true, session_log_id: result.rows[0].id },
  };
}

type ToolHandler = (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;

export const TOOL_HANDLERS: Record<ToolName, ToolHandler> = {
  get_user_context: getUserContext,
  update_profile: updateProfile,
  navigate_next: navigateNext,
  log_event: logEvent,
};

export async function dispatchToolCall(
  ctx: ToolContext,
  name: ToolName,
  args: unknown,
): Promise<ToolResult> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { ok: false, error: 'unknown_tool', message: `Unknown tool: ${String(name)}` };
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return invalid('args must be an object');
  }
  return handler(ctx, args as Record<string, unknown>);
}
