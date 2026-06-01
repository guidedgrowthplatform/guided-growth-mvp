import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getNumber, invalid, ok, todayStr, type CheckinHandlerCtx } from './shared.js';

const DIMENSIONS = ['sleep', 'mood', 'energy', 'stress'] as const;

export async function recordCheckin(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const values: Record<string, number | null> = {};
  let provided = 0;
  for (const dim of DIMENSIONS) {
    const v = getNumber(args, dim);
    if (v === undefined) {
      values[dim] = null;
      continue;
    }
    if (!Number.isInteger(v) || v < 1 || v > 5) return invalid(`${dim} must be an integer 1-5`);
    values[dim] = v;
    provided++;
  }
  if (provided === 0) return invalid('provide at least one of sleep, mood, energy, stress (1-5)');

  const date = todayStr(ctx.timezone);
  // COALESCE keeps prior dims when a later partial check-in omits them.
  const res = await pool.query<{
    sleep: number | null;
    mood: number | null;
    energy: number | null;
    stress: number | null;
  }>(
    `INSERT INTO daily_checkins (anon_id, date, sleep, mood, energy, stress)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (anon_id, date) DO UPDATE SET
       sleep = COALESCE(EXCLUDED.sleep, daily_checkins.sleep),
       mood = COALESCE(EXCLUDED.mood, daily_checkins.mood),
       energy = COALESCE(EXCLUDED.energy, daily_checkins.energy),
       stress = COALESCE(EXCLUDED.stress, daily_checkins.stress),
       updated_at = now()
     RETURNING sleep, mood, energy, stress`,
    [ctx.anon_id, date, values.sleep, values.mood, values.energy, values.stress],
  );

  return ok({ recorded: true, date, checkin: res.rows[0] });
}
