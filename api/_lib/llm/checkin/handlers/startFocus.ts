import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import {
  checkDedup,
  findHabitByName,
  getNumber,
  getString,
  invalid,
  normalizeVoiceName,
  notFound,
  ok,
  type CheckinHandlerCtx,
} from './shared.js';

export async function startFocus(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const cached = await checkDedup(ctx);
  if (cached) return cached;

  const duration = getNumber(args, 'duration') ?? 25;
  if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
    return invalid('duration must be an integer number of minutes (1-600)');
  }

  let habitId: string | null = null;
  let habitName: string | null = null;
  const rawHabit = getString(args, 'habit');
  if (rawHabit) {
    const name = normalizeVoiceName(rawHabit);
    const habit = await findHabitByName(ctx.anon_id, name);
    if (!habit) return notFound(`No habit called "${name}" to focus on.`);
    habitId = habit.id;
    habitName = habit.name;
  }

  const res = await pool.query<{ id: string; duration_minutes: number; started_at: string }>(
    `INSERT INTO focus_sessions (anon_id, habit_id, duration_minutes, actual_minutes, status, started_at)
     VALUES ($1, $2, $3, null, 'completed', now())
     RETURNING id, duration_minutes, started_at`,
    [ctx.anon_id, habitId, duration],
  );
  const row = res.rows[0];

  return ok({
    started: true,
    focus: { id: row.id, duration_minutes: row.duration_minutes, habit: habitName },
  });
}
