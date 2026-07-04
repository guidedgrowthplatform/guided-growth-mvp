import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getNumber, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

export async function submitWeeklyConfig(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const day = getNumber(args, 'day');
  if (day === undefined || !Number.isInteger(day) || day < 0 || day > 6) {
    return invalid('day must be an integer 0-6');
  }

  const weeklyConfig = { day };
  const payload = JSON.stringify({ weeklyConfig });

  // GREATEST-bump to the weekly-day beat's V3 persist step (9), the same
  // self-advancing pattern as submitReflectionConfig (step 8) and
  // submitMorningCheckin (step 7) — a voice save survives refresh identically
  // to the tap save. Later edits re-call this; GREATEST never rewinds.
  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 9, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 9),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { weeklyConfig },
    current_step: row?.current_step ?? 9,
    weeklyConfig,
  });
}
