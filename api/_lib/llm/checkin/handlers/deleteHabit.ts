import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { ok, resolveHabitArg, type CheckinHandlerCtx } from './shared.js';

export async function deleteHabit(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const found = await resolveHabitArg(ctx.anon_id, args);
  if (!found.ok) return found.error;
  const habit = found.value;

  // Soft delete: archive instead of removing.
  await pool.query(
    `UPDATE user_habits SET is_active = false, archived_at = now() WHERE id = $1 AND anon_id = $2`,
    [habit.id, ctx.anon_id],
  );

  return ok({ deleted: true, habit: { id: habit.id, name: habit.name } });
}
