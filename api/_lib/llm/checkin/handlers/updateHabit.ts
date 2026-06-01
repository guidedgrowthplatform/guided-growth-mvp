import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { HABIT_NAME_MAX_LEN } from '../schemas.js';
import {
  cadenceFromFrequency,
  daysBoolFrom,
  getString,
  invalid,
  notFound,
  ok,
  resolveHabitArg,
  validateFrequency,
  type CheckinHandlerCtx,
} from './shared.js';

interface UpdatedHabit {
  id: string;
  name: string;
  cadence: string;
  schedule_days: number[] | null;
}

export async function updateHabit(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const newName = getString(args, 'new_name')?.trim();
  if (newName !== undefined && newName.length > HABIT_NAME_MAX_LEN) {
    return invalid(`new_name must be at most ${HABIT_NAME_MAX_LEN} characters`);
  }

  const frequency = getString(args, 'frequency');
  const freqErr = validateFrequency(frequency);
  if (freqErr) return freqErr;

  if (newName === undefined && frequency === undefined) {
    return invalid('provide new_name and/or frequency to update');
  }

  const found = await resolveHabitArg(ctx.anon_id, args);
  if (!found.ok) return found.error;
  const habit = found.value;

  const cadence = frequency !== undefined ? cadenceFromFrequency(frequency) : undefined;
  const res = await pool.query<UpdatedHabit>(
    `UPDATE user_habits
        SET name = COALESCE($3, name),
            cadence = COALESCE($4, cadence)
      WHERE id = $1 AND anon_id = $2
      RETURNING id, name, cadence, schedule_days`,
    [habit.id, ctx.anon_id, newName ?? null, cadence ?? null],
  );
  const row = res.rows[0];
  if (!row) return notFound(`No habit called "${habit.name}".`);

  return ok({
    updated: true,
    habit: {
      id: row.id,
      name: row.name,
      frequency: row.cadence,
      schedule_days: row.schedule_days,
      days: daysBoolFrom(row.cadence, row.schedule_days),
    },
  });
}
