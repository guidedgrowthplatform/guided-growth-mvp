/**
 * navigate_next handler — advances the user one onboarding screen forward.
 *
 * Auth model: see submitProfile.ts. Channel auth via X-Vapi-Secret; identity
 * arrives as `anon_id` injected by Vapi from static call params.
 *
 * SECURITY: the target step is NOT trusted from the LLM. A forward request
 * (target_step > persisted step) is gated atomically — source screen, REQUIRED
 * check, and GREATEST UPDATE all run against ONE FOR-UPDATE-locked row, so a
 * concurrent submit_path_choice can't swap `path` between the source read and
 * the gate. A target <= persisted step is a back-nav ack (no write). So voice
 * cannot skip a step whose required data isn't persisted, and cannot move
 * backward or jump multiple steps. The `target_step` value itself is only ever
 * compared, never written.
 *
 * The browser hook (useAgentNavigation) is leading-edge: it fires navigate()
 * only when current_step transitions during the mount, so a fresh landing on a
 * back-navved page won't auto-yank; only a real advance during the visit will.
 */
import pool from '../../db.js';
import { advanceStepIfReadyAtomic } from '../../llm/onboarding/handlers/confirmStepComplete.js';

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

  const state = await pool.query<{ current_step: number | null }>(
    `SELECT current_step FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  const currentStep = state.rows[0]?.current_step ?? 1;

  // Back-nav walk-forward (assistant.ts RULE 3): a user editing an earlier
  // screen confirms "go forward" and the LLM calls navigate_next with the
  // next screen's step, which is <= the persisted (GREATEST-preserved) step.
  // This can't and must not write — it's a pure navigation ack so the LLM
  // proceeds. The client already sits ahead; monotonicity is preserved.
  // Only a target BEYOND the persisted step goes through the atomic gate.
  if (targetStep <= currentStep) {
    console.log(
      `[vapi/tool] navigate_next ack (no write) target_step=${targetStep} current_step=${currentStep}`,
    );
    return { result: 'ok' };
  }

  // Genuine forward advance: derive the source screen from the SAME locked row
  // the gate + UPDATE use, closing the stale-path race with submit_path_choice.
  const advance = await advanceStepIfReadyAtomic(anonId);
  if (!advance.advanced) {
    console.log(`[vapi/tool] navigate_next blocked reason=${advance.reason}`);
    return { error: `no_advance: ${advance.reason}` };
  }

  console.log(`[vapi/tool] navigate_next written current_step=${advance.current_step}`);
  return { result: 'ok' };
}
