import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { checkAdvanceData } from '../preconditions.js';
import { getNumber, handlerError, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

const MIN_STEP = 1;
const MAX_STEP = 10;

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
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const path = row?.path ?? null;
  const brainDumpRaw = row?.brain_dump_raw ?? null;

  // Jumps beyond +2 are genuine skips → reject. Same step / back-nav allowed.
  if (targetStep > currentStep + 2) {
    return handlerError(
      `cannot_skip_steps: current_step=${currentStep}, target_step=${targetStep}. Advance one step at a time.`,
    );
  }

  // +2 is a tap/voice catch-up: tap-navigation into the current screen does NOT
  // bump current_step, so a subsequent agent advance lands two ahead. Allow it
  // ONLY when BOTH steps being left already have their data saved.
  if (targetStep === currentStep + 2) {
    for (let s = currentStep; s < targetStep; s++) {
      if (checkAdvanceData({ sourceStep: s, data, path, brainDumpRaw })) {
        return handlerError(
          `cannot_skip_steps: current_step=${currentStep}, target_step=${targetStep}. Advance one step at a time.`,
        );
      }
    }
  }

  // Forward advance — the source screen's data must be saved.
  if (targetStep === currentStep + 1) {
    const missing = checkAdvanceData({ sourceStep: currentStep, data, path, brainDumpRaw });
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
