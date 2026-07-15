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
         bool_or(date = $3 AND status = 'done') AS completed_today,
         count(*) FILTER (WHERE status = 'done'
           AND date >= ($3::date - INTERVAL '30 days'))::int AS last_30
       FROM habit_completions
       WHERE habit_id = $1 AND anon_id = $2`,
      [habit.id, ctx.anon_id, today],
    );
    const row = res.rows[0];
    return ok({
      habit: {
        name: habit.name,
        frequency: habit.cadence,
        type: habit.habit_type === 'binary_avoid' || habit.habit_type === 'binary_break' ? 'avoid' : 'do',
        completed_today: row?.completed_today ?? false,
        completions_last_30_days: row?.last_30 ?? 0,
      },
    });
  }

  const res = await pool.query<{
    name: string;
    cadence: string;
    habit_type: string;
    schedule_days: number[] | null;
  }>(
    `SELECT name, cadence, habit_type, schedule_days FROM user_habits
      WHERE anon_id = $1 AND is_active = true AND archived_at IS NULL
      ORDER BY sort_order ASC`,
    [ctx.anon_id],
  );

  // Default 'all' keeps #219 read-back unaffected; 'today' filters to today's schedule.
  const scope = getString(args, 'scope') === 'today' ? 'today' : 'all';
  const rows =
    scope === 'today'
      ? res.rows.filter((r) => isScheduledToday(r.schedule_days, ctx.timezone))
      : res.rows;

  return ok({
    habits: rows.map((r) => ({
      name: r.name,
      frequency: r.cadence,
      type: r.habit_type === 'binary_avoid' || r.habit_type === 'binary_break' ? 'avoid' : 'do',
    })),
    count: rows.length,
  });
}

// null/empty schedule = always included. Weekday read in the caller's tz.
function isScheduledToday(scheduleDays: number[] | null, tz: string = 'UTC'): boolean {
  if (!scheduleDays || scheduleDays.length === 0) return true;
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(
    new Date(),
  );
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday];
  return dow !== undefined && scheduleDays.includes(dow);
}
