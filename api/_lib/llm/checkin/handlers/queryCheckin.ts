import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { ok, todayStr, type CheckinHandlerCtx } from './shared.js';

// Read-only: returns today's check-in row (or all-null if none yet) so the
// client can render the interactive 4-scale card inline on the morning opener.
// Same payload shape as record_checkin so buildCheckinCard reads either.
export async function queryCheckin(ctx: CheckinHandlerCtx): Promise<ToolResult> {
  const date = todayStr(ctx.timezone);
  const res = await pool.query<{
    sleep: number | null;
    mood: number | null;
    energy: number | null;
    stress: number | null;
  }>(`SELECT sleep, mood, energy, stress FROM daily_checkins WHERE anon_id = $1 AND date = $2`, [
    ctx.anon_id,
    date,
  ]);
  const checkin = res.rows[0] ?? { sleep: null, mood: null, energy: null, stress: null };
  return ok({ date, checkin });
}
