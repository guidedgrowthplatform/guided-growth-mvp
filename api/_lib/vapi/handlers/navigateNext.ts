/**
 * navigate_next handler — advances the user one onboarding screen forward.
 *
 * Auth model: see submitProfile.ts. Channel auth via X-Vapi-Secret; identity
 * arrives as `anon_id` injected by Vapi from static call params.
 *
 * SECURITY: the target step is NOT trusted from the LLM. The LLM may only
 * REQUEST an advance; the server derives the source screen from the trusted
 * persisted (current_step, path) and gates on the same REQUIRED/NEXT_STEP
 * rules as confirm_step_complete. So voice cannot skip a step whose required
 * data isn't persisted, and — via GREATEST in advanceStepIfReady — cannot move
 * backward or jump multiple steps. The historical `target_step` arg is accepted
 * for wire-compat but only sanity-checked, never written.
 *
 * The browser hook (useAgentNavigation) is leading-edge: it fires navigate()
 * only when current_step transitions during the mount, so a fresh landing on a
 * back-navved page won't auto-yank; only a real advance during the visit will.
 */
import pool from '../../db.js';
import {
  advanceStepIfReady,
  sourceScreenForStep,
} from '../../llm/onboarding/handlers/confirmStepComplete.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_STEP = 1;
const MAX_STEP = 10;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// GPT-family drift: numeric schemas occasionally return strings.
function getInteger(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) {
    const n = parseInt(v, 10);
    return Number.isInteger(n) ? n : undefined;
  }
  return undefined;
}

export async function navigateNext(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=navigate_next anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const targetStep = getInteger(args, 'target_step');
  if (targetStep === undefined) {
    console.log('[vapi/tool] validation_failed reason=target_step_not_integer');
    return { error: 'validation_failed: target_step must be an integer' };
  }
  if (targetStep < MIN_STEP || targetStep > MAX_STEP) {
    console.log(
      `[vapi/tool] validation_failed reason=target_step_out_of_range value=${targetStep}`,
    );
    return {
      error: `validation_failed: target_step must be between ${MIN_STEP} and ${MAX_STEP}`,
    };
  }

  // Seed the row if a tool somehow fires before any submit_* did (defensive —
  // the row should already exist). Never overwrites an existing current_step.
  await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, updated_at)
     VALUES ($1, 1, 'in_progress', now())
     ON CONFLICT (anon_id) DO NOTHING`,
    [anonId],
  );

  const state = await pool.query<{ current_step: number | null; path: string | null }>(
    `SELECT current_step, path FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  const currentStep = state.rows[0]?.current_step ?? 1;
  const path = state.rows[0]?.path ?? null;

  const screenId = sourceScreenForStep(currentStep, path);
  if (!screenId) {
    console.log(
      `[vapi/tool] navigate_next no_source_screen current_step=${currentStep} path=${path}`,
    );
    return { error: 'no_advance: no next screen for the current step' };
  }

  const advance = await advanceStepIfReady(anonId, screenId);
  if (!advance.advanced) {
    console.log(`[vapi/tool] navigate_next blocked screen=${screenId} reason=${advance.reason}`);
    return { error: `no_advance: ${advance.reason}` };
  }

  console.log(
    `[vapi/tool] navigate_next written screen=${screenId} current_step=${advance.current_step}`,
  );
  return { result: 'ok' };
}
