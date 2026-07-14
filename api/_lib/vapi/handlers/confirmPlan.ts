/**
 * confirm_plan handler — completes State-1 onboarding server-side (atomic:
 * status=completed, completed_at, data.plan.confirmed=true, habit promotion) so
 * an interrupted client (app closed post-confirm) isn't stranded. Also bumps
 * current_step to 8 (monotonic GREATEST, never regresses) — useFlowOrchestrator's
 * fork-advance leading edge relies on that pin. Re-confirm is an idempotent no-op.
 *
 * Auth model: see navigateNext.ts. Channel auth via X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 */
import pool, { type Queryable } from '../../db.js';
import { completeOnboarding } from '../../onboarding/completeOnboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

export async function confirmPlan(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  const anonId = typeof args.anon_id === 'string' ? args.anon_id : undefined;
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity name=confirm_plan');
    return { error: 'invalid_identity' };
  }

  // Precondition: the row must already contain habitConfigs (beginner or advanced)
  // AND reflectionConfig before completion. Otherwise the agent jumped ahead and
  // PlanReviewPage would crash trying to render a half-built plan. Reject so the
  // agent (per RULE 6) retries silently and the user is steered back to the
  // missing screen.
  const existing = await db.query<{
    data: Record<string, unknown> | null;
    current_step: number | null;
  }>(`SELECT data, current_step FROM onboarding_states WHERE anon_id = $1`, [anonId]);
  const row = existing.rows[0];
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const habitConfigs = data.habitConfigs as Record<string, unknown> | undefined;
  const advancedHabitConfigs = data.advancedHabitConfigs as Record<string, unknown> | undefined;
  const hasHabits =
    (habitConfigs && Object.keys(habitConfigs).length > 0) ||
    (advancedHabitConfigs && Object.keys(advancedHabitConfigs).length > 0);
  const hasReflection = !!data.reflectionConfig;
  const currentStep = row?.current_step ?? null;
  if (!hasHabits || !hasReflection) {
    console.log(
      `[vapi/tool] confirm_plan rejected reason=preconditions_not_met hasHabits=${!!hasHabits} hasReflection=${hasReflection} current_step=${currentStep ?? 'null'}`,
    );
    // Directive error — tell the model the exact tool to call next so it can
    // recover without spinning rejected confirm_plan retries (which crashes Vapi).
    let next = '';
    if (currentStep != null && currentStep < 6) {
      next = ` Call navigate_next(target_step=${currentStep + 1}) instead. Do NOT retry confirm_plan until current_step is 7.`;
    } else if (!hasReflection) {
      next =
        ' Call submit_reflection_config first, then navigate_next(target_step=7). Do NOT retry confirm_plan until then.';
    } else if (!hasHabits) {
      next =
        ' Call add_habit at least once first, then navigate_next forward. Do NOT retry confirm_plan until current_step is 7.';
    }
    return {
      error: `confirm_plan_too_early: current_step=${currentStep ?? 'unknown'}, ${!hasHabits ? 'habits' : ''}${!hasHabits && !hasReflection ? '+' : ''}${!hasReflection ? 'reflection' : ''} not yet saved.${next}`,
    };
  }

  // current_step pin kept (fork-advance leading edge); status flips to completed
  // inside completeOnboarding, so this UPDATE no longer forces 'in_progress'.
  const result = await db.query(
    `UPDATE onboarding_states
       SET current_step = GREATEST(onboarding_states.current_step, 8), updated_at = now()
     WHERE anon_id = $1`,
    [anonId],
  );

  const completion = await completeOnboarding({ anonId, setPlanConfirmed: true });
  if (!completion.ok) {
    console.log('[vapi/tool] confirm_plan completion_failed reason=no_state');
    return { error: 'confirm_plan_failed: no onboarding state found' };
  }

  console.log(
    `[vapi/tool] confirm_plan written rows=${result.rowCount ?? 0} alreadyCompleted=${completion.alreadyCompleted}`,
  );
  return { result: 'ok' };
}
