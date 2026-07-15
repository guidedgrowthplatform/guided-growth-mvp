import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import {
  getString,
  getStringArray,
  invalid,
  ok,
  parseDateParam,
  resolveHabitArg,
  todayStr,
  type CheckinHandlerCtx,
} from './shared.js';

export async function markMissed(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const found = await resolveHabitArg(ctx.anon_id, args);
  if (!found.ok) return found.error;
  const habit = found.value;

  const datesArg = getStringArray(args, 'dates');
  const rawDates =
    datesArg && datesArg.length > 0 ? datesArg : [getString(args, 'date') ?? 'today'];

  const today = todayStr(ctx.timezone);
  const missed: string[] = [];
  for (const raw of rawDates) {
    const date = parseDateParam(raw, ctx.timezone);
    if (date === null) return invalid(`I didn't recognize "${raw}" as a date.`);
    if (date > today)
      return invalid(`Cannot mark "${habit.name}" missed for a future date (${date}).`);
    await pool.query(
      `INSERT INTO habit_completions (anon_id, habit_id, date, status)
       VALUES ($1, $2, $3, 'missed')
       ON CONFLICT (habit_id, date) DO UPDATE SET completed_at = now(), status = 'missed'`,
      [ctx.anon_id, habit.id, date],
    );
    missed.push(date);
  }

  return ok({
    missed: true,
    habit: {
      id: habit.id,
      name: habit.name,
      type: habit.habit_type === 'binary_avoid' ? 'avoid' : 'do',
    },
    dates: missed,
  });
}
