import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { checkAdvanceData } from '../preconditions.js';
import { FIRST_STEP, MAX_DB_STEP } from '../stepTable.js';
import { getNumber, handlerError, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

const MIN_STEP = FIRST_STEP;
const MAX_STEP = MAX_DB_STEP;

// Only tool that writes current_step. Bare-set (no GREATEST) so back-nav forward re-fires useAgentNavigation.
export async function advanceStep(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const targetStep = getNumber(args, 'target_step');
  if (targetStep === undefined || !Number.isInteger(targetStep)) {
    return invalid('target_step must be an integer');
  }
  if (targetStep < MIN_STEP || targetStep > MAX_STEP) {
    return invalid(`target_step must be between ${MIN_STEP} and ${MAX_STEP}`);
  }

  const existing = await pool.query<{
    current_step: number;
    data: Record<string, unknown> | null;
    path: string | null;
    brain_dump_raw: string | null;
  }>(`SELECT current_step, data, path, brain_dump_raw FROM onboarding_states WHERE anon_id = $1`, [
    ctx.anon_id,
  ]);
  const row = existing.rows[0];
  const currentStep = row?.current_step ?? 1;

  // No multi-step jumps. Same step / back-nav allowed.
  if (targetStep > currentStep + 1) {
    return handlerError(
      `cannot_skip_steps: current_step=${currentStep}, target_step=${targetStep}. Advance one step at a time.`,
    );
  }

  // Forward advance — the source screen's data must be saved.
  if (targetStep === currentStep + 1) {
    const missing = checkAdvanceData({
      sourceStep: currentStep,
      data: (row?.data ?? {}) as Record<string, unknown>,
      path: row?.path ?? null,
      brainDumpRaw: row?.brain_dump_raw ?? null,
    });
    if (missing) return handlerError(missing);
  }

  const result = await pool.query<{ current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, updated_at)
     VALUES ($1, $2, 'in_progress', now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = $2,
       status = 'in_progress',
       updated_at = now()
     RETURNING current_step`,
    [ctx.anon_id, targetStep],
  );

  return ok({ current_step: result.rows[0]?.current_step ?? targetStep });
}
