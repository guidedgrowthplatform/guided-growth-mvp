import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { DEFAULT_SUGGESTION, HABIT_SUGGESTIONS, ok, type CheckinHandlerCtx } from './shared.js';

export async function suggestHabit(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const res = await pool.query<{ name: string }>(
    `SELECT name FROM user_habits WHERE anon_id = $1 AND is_active = true`,
    [ctx.anon_id],
  );
  const existing = new Set(res.rows.map((r) => r.name.toLowerCase()));
  const available = HABIT_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));

  // Deterministic pick off tool_call_id (no Math.random for test/replay stability).
  let suggestion = DEFAULT_SUGGESTION;
  if (available.length > 0) {
    const seed = (ctx.tool_call_id ?? '').length + Object.keys(args).length;
    suggestion = available[seed % available.length];
  }
  return ok({ suggestion });
}
