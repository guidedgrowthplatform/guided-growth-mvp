import { dbHabitType } from '@gg/shared';
import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { HABIT_NAME_MAX_LEN } from '../schemas.js';
import {
  cadenceFromFrequency,
  checkDedup,
  daysBoolFrom,
  findHabitByName,
  getNumberArray,
  getString,
  invalid,
  ok,
  validateFrequency,
  type CheckinHandlerCtx,
} from './shared.js';

interface InsertedHabit {
  id: string;
  name: string;
  cadence: string;
  schedule_days: number[] | null;
}

export async function createHabit(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const cached = await checkDedup(ctx);
  if (cached) return cached;

  const name = getString(args, 'name')?.trim();
  if (!name) return invalid('name is required');
  if (name.length > HABIT_NAME_MAX_LEN) {
    return invalid(`name must be at most ${HABIT_NAME_MAX_LEN} characters`);
  }

  const frequency = getString(args, 'frequency');
  const freqErr = validateFrequency(frequency);
  if (freqErr) return freqErr;

  const scheduleDays = getNumberArray(args, 'schedule_days');
  if (scheduleDays !== undefined) {
    for (const d of scheduleDays) {
      if (!Number.isInteger(d) || d < 0 || d > 6) return invalid('schedule_days must be ints 0-6');
    }
  }

  const existing = await findHabitByName(ctx.anon_id, name);
  if (existing) return invalid(`You already have a habit called "${existing.name}".`);

  const cadence = cadenceFromFrequency(frequency);
  // Derive polarity from the habit NAME, not the LLM-supplied habit_type. A
  // predefined Break habit ("No caffeine after 2 PM") resolves to 'binary_break'
  // via the shared catalog; custom names fall through the shared regex fallback.
  const habitType = dbHabitType(name);
  const res = await pool.query<InsertedHabit>(
    `INSERT INTO user_habits (anon_id, name, habit_type, cadence, schedule_days, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, true, 9999)
     RETURNING id, name, cadence, schedule_days`,
    [ctx.anon_id, name, habitType, cadence, scheduleDays ?? null],
  );
  const row = res.rows[0];

  return ok({
    created: true,
    habit: {
      id: row.id,
      name: row.name,
      frequency: row.cadence,
      schedule_days: row.schedule_days,
      days: daysBoolFrom(row.cadence, row.schedule_days),
    },
  });
}
