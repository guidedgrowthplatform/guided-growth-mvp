/**
 * navigate_next handler — advances the user one onboarding screen forward.
 *
 * Auth model: see submitProfile.ts. Channel auth via X-Vapi-Secret; identity
 * arrives as `anon_id` injected by Vapi from static call params.
 *
 * SECURITY: a forward advance is never trusted from the LLM. EVERY decision
 * (back-nav vs forward vs out-of-sequence, source screen, REQUIRED gate, the
 * write) runs against ONE FOR-UPDATE-locked row in advanceStepIfReadyAtomic.
 * Forward is exact-next only (target == locked step + 1), so repeated calls
 * cannot chain past unseen screens and a stale pre-read can't misclassify.
 * target <= locked step is the documented back-nav write (assistant RULE 3):
 * realtime on current_step drives client navigation.
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

  const advance = await advanceStepIfReadyAtomic(anonId, targetStep);
  if (!advance.advanced) {
    console.log(`[vapi/tool] navigate_next blocked reason=${advance.reason}`);
    return { error: `no_advance: ${advance.reason}` };
  }

  console.log(`[vapi/tool] navigate_next written current_step=${advance.current_step}`);
  return { result: 'ok' };
}
