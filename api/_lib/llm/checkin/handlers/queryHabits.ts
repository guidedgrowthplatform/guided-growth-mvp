import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getString, ok, resolveHabitArg, todayStr, type CheckinHandlerCtx } from './shared.js';

export async function queryHabits(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const rawName = getString(args, 'name');

  if (rawName && rawName.trim() !== '') {
    const found = await resolveHabitArg(ctx.anon_id, args);
    if (!found.ok) return found.error;
    const habit = found.value;

    const today = todayStr(ctx.timezone);
    const res = await pool.query<{ completed_today: boolean; last_30: number }>(
      `SELECT
         bool_or(date = $3) AS completed_today,
         count(*) FILTER (WHERE date > ($3::date - INTERVAL '30 days'))::int AS last_30
       FROM habit_completions
       WHERE habit_id = $1 AND anon_id = $2`,
      [habit.id, ctx.anon_id, today],
    );
    const row = res.rows[0];
    return ok({
      habit: {
        name: habit.name,
        frequency: habit.cadence,
        type: habit.habit_type === 'binary_avoid' ? 'avoid' : 'do',
        completed_today: row?.completed_today ?? false,
        completions_last_30_days: row?.last_30 ?? 0,
      },
    });
  }

  const res = await pool.query<{ name: string; cadence: string; habit_type: string }>(
    `SELECT name, cadence, habit_type FROM user_habits
      WHERE anon_id = $1 AND is_active = true AND archived_at IS NULL
      ORDER BY sort_order ASC`,
    [ctx.anon_id],
  );
  return ok({
    habits: res.rows.map((r) => ({
      name: r.name,
      frequency: r.cadence,
      type: r.habit_type === 'binary_avoid' ? 'avoid' : 'do',
    })),
    count: res.rowCount ?? 0,
  });
}
