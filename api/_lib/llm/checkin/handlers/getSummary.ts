import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { ok, todayStr, type CheckinHandlerCtx } from './shared.js';

export async function getSummary(ctx: CheckinHandlerCtx): Promise<ToolResult> {
  const today = todayStr(ctx.timezone);
  // Last 7 days inclusive.
  const res = await pool.query<{
    active_habits: number;
    completions: number;
    checkins: number;
    journals: number;
  }>(
    `SELECT
       (SELECT count(*) FROM user_habits
          WHERE anon_id = $1 AND is_active = true AND archived_at IS NULL)::int AS active_habits,
       (SELECT count(*) FROM habit_completions
          WHERE anon_id = $1 AND date > ($2::date - INTERVAL '7 days'))::int AS completions,
       (SELECT count(*) FROM daily_checkins
          WHERE anon_id = $1 AND date > ($2::date - INTERVAL '7 days'))::int AS checkins,
       (SELECT count(*) FROM journal_entries
          WHERE anon_id = $1 AND date > ($2::date - INTERVAL '7 days'))::int AS journals`,
    [ctx.anon_id, today],
  );
  const row = res.rows[0];
  return ok({
    period_days: 7,
    active_habits: row?.active_habits ?? 0,
    habit_completions: row?.completions ?? 0,
    checkins: row?.checkins ?? 0,
    journal_entries: row?.journals ?? 0,
  });
}
