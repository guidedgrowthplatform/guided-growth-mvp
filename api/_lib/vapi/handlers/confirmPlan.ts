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
