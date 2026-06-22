/**
 * confirm_plan handler — completes State-1 onboarding by bumping
 * current_step to 8. Monotonic GREATEST so it never regresses; the >7
 * threshold completes both beginner (step 7) and advanced (step 6).
 *
 * status stays 'in_progress' — client PlanReviewPage.complete() flips it to
 * 'completed'. Interrupted confirm (app closed pre-complete) → AppGate routes
 * the in_progress row back to /onboarding to re-confirm; recoverable, not stuck.
 *
 * Auth model: see navigateNext.ts. Channel auth via X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 */
import pool from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

export async function confirmPlan(args: Record<string, unknown>): Promise<HandlerResult> {
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
  const existing = await pool.query<{
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

  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, updated_at)
     VALUES ($1, 8, 'in_progress', now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 8),
       status = 'in_progress',
       updated_at = now()`,
    [anonId],
  );

  console.log(`[vapi/tool] confirm_plan written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
