import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { checkPlanReady } from '../preconditions.js';
import { handlerError, ok, type OnboardingHandlerCtx } from './shared.js';

// Completion side-effect is client-side (PlanReviewPage.complete()); this tool
// only signals the user confirmed. Guard rejects if habits + reflection aren't
// saved so PlanReviewPage never renders a half-built plan.
export async function confirmPlan(
  ctx: OnboardingHandlerCtx,
  _args: Record<string, unknown>,
): Promise<ToolResult> {
  const existing = await pool.query<{
    data: Record<string, unknown> | null;
    current_step: number | null;
  }>(`SELECT data, current_step FROM onboarding_states WHERE anon_id = $1`, [ctx.anon_id]);
  const row = existing.rows[0];
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const { hasHabits, hasReflection } = checkPlanReady(data);
  const currentStep = row?.current_step ?? null;

  if (!hasHabits || !hasReflection) {
    const next =
      currentStep != null && currentStep < 6
        ? ` Call advance_step(target_step=${currentStep + 1}) instead.`
        : !hasReflection
          ? ' Call submit_reflection_config first, then advance_step(target_step=7).'
          : ' Call add_habit first, then advance forward.';
    return handlerError(
      `confirm_plan_too_early: ${!hasHabits ? 'habits' : ''}${!hasHabits && !hasReflection ? '+' : ''}${!hasReflection ? 'reflection' : ''} not yet saved.${next}`,
    );
  }

  return ok({ confirmed: true });
}
