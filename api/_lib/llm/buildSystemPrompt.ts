import pool from '../db.js';
import { buildSystemPrompt } from '@shared/coaching/systemPrompt.js';
import type { CoachingStyle } from '@shared/coaching/styles.js';
import { buildContextMessage } from '@shared/context/buildContextMessage.js';
import type { SessionStateDeltaEntry } from '@shared/types/context.js';

export interface BuildSystemPromptArgs {
  user_id: string;
  screen_id: string;
  coaching_style: CoachingStyle;
}

export interface BuildSystemPromptResult {
  systemPrompt: string;
  contextVersion: number;
  deltaCount: number;
}

export class BuildSystemPromptError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

interface ScreenRow {
  context_block: string;
  version: number;
}

interface SessionLogRow {
  id: string;
  session_id: string;
  timestamp: Date;
  event_type: string;
  screen_id: string | null;
  payload: Record<string, unknown> | null;
}

export async function buildSystemPromptForRequest(
  args: BuildSystemPromptArgs,
): Promise<BuildSystemPromptResult> {
  const screenRes = await pool.query<ScreenRow>(
    `SELECT context_block, version FROM screen_contexts WHERE screen_id = $1`,
    [args.screen_id],
  );
  if (screenRes.rowCount === 0) {
    throw new BuildSystemPromptError(
      'unknown_screen_id',
      404,
      `Unknown screen_id: ${args.screen_id}`,
    );
  }
  const screen = screenRes.rows[0];

  // Exclude llm_call events: they are bookkeeping about prior calls, not user
  // activity. Including them in state_delta drowns out real events (navigate,
  // habit_completed, mic_tapped) once chat-debug is used a few times.
  const logRes = await pool.query<SessionLogRow>(
    `SELECT id, session_id, timestamp, event_type, screen_id, payload
       FROM session_log
      WHERE user_id = $1 AND event_type <> 'llm_call'
      ORDER BY timestamp DESC
      LIMIT 15`,
    [args.user_id],
  );

  const state_delta: SessionStateDeltaEntry[] = logRes.rows
    .map((r) => ({
      id: r.id,
      session_id: r.session_id,
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
      event_type: r.event_type,
      screen_id: r.screen_id,
      payload: r.payload,
    }))
    .reverse();

  const coachingPreamble = buildSystemPrompt({ coachingStyle: args.coaching_style });
  const contextMessage = buildContextMessage({
    screen_id: args.screen_id,
    context_block: screen.context_block,
    state_delta,
  });

  return {
    systemPrompt: `${coachingPreamble}\n\n${contextMessage}`,
    contextVersion: screen.version,
    deltaCount: state_delta.length,
  };
}
