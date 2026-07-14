import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { completeOnboarding } from '../../../onboarding/completeOnboarding.js';
import { checkPlanReady } from '../preconditions.js';
import { handlerError, ok, type OnboardingHandlerCtx } from './shared.js';

// Guard rejects if habits + reflection aren't saved (PlanReviewPage never renders
// a half-built plan), then completion runs server-side (atomic: status=completed,
// completed_at, data.plan.confirmed=true, habit promotion) so a client that dies
// after confirming isn't stranded. Re-confirm is an idempotent no-op success.
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

  const result = await completeOnboarding({ anonId: ctx.anon_id, setPlanConfirmed: true });
  if (!result.ok) return handlerError('confirm_plan_failed: no onboarding state found');
  return ok({ confirmed: true });
}
