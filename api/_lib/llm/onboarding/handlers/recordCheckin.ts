import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getNumber, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

// Persist the state-check result (sleep, mood, energy, stress) from the
// state-check beat. Mirrors submitMorningCheckin: merge-upsert into
// onboarding_states.data.stateCheck, GREATEST-bump current_step to the beat's
// V3 persist step (6) — same semantics as the tap save path, so a voice save
// survives a refresh identically to a tap.
//
// TODO(finalize: map onboarding stateCheck -> daily_checkins at onboarding-complete)
export async function recordCheckin(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const DIMS = ['sleep', 'mood', 'energy', 'stress'] as const;

  const values: Record<string, number> = {};
  for (const dim of DIMS) {
    const v = getNumber(args, dim);
    if (v !== undefined) {
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        return invalid(`${dim} must be an integer 1-5`);
      }
      values[dim] = v;
    }
  }

  if (Object.keys(values).length === 0) {
    return invalid('at least one dimension (sleep, mood, energy, stress) is required');
  }

  const payload = JSON.stringify({ stateCheck: values });

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 6, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 6),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { stateCheck: values },
    current_step: row?.current_step ?? 6,
    stateCheck: values,
  });
}
