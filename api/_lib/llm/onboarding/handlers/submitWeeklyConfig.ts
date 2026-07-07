import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getNumber, handlerError, invalid, ok, type OnboardingHandlerCtx } from './shared.js';
import { checkSetupConfigGuard, SURFACES } from './setupConfigGuard.js';

export async function submitWeeklyConfig(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // B58 server-side guard: same pattern as submitMorningCheckin. See
  // setupConfigGuard.ts doc comment for the two-leg design. Weekly config's
  // only field is a day-of-week int, so leg 2's CONFIG_CONTENT_RE (which
  // matches weekday names) still recognizes real grounding here.
  const guard = checkSetupConfigGuard(SURFACES.weekly, ctx.user_text);
  if (guard.blocked) return handlerError(guard.code);

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
