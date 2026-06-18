/**
 * navigate_next handler — moves the user to the next onboarding screen by
 * setting `onboarding_states.current_step` to the LLM-supplied target.
 *
 * Auth model: see submitProfile.ts. Channel auth via X-Vapi-Secret; identity
 * arrives as `anon_id` injected by Vapi from static call params.
 *
 * This is the ONLY tool that writes `current_step`. The submit_* family is
 * data-only — they merge fields into `onboarding_states.data` but never
 * touch the step. Splitting these two responsibilities means:
 *
 *  - The LLM can partial-update a screen as many times as it likes without
 *    accidentally advancing the user mid-conversation.
 *  - Premature advance is impossible: only an explicit `navigate_next` call
 *    (always preceded by a user confirmation per the system prompt) moves
 *    the user to the next screen.
 *  - Back-nav edits stay put: edit tools fire freely, step doesn't change,
 *    auto-nav doesn't yank the user forward.
 *
 * The hook on the browser side (useAgentNavigation) is "leading-edge" —
 * it fires `navigate()` only when current_step transitions during the
 * mount, not when it's already past at first observation. So a fresh
 * landing on a back-navved page won't auto-yank; only a real navigate_next
 * call during the visit will.
 *
 * No GREATEST — we explicitly let target_step decrease the step if the
 * LLM says to (e.g. user back-navved from step 5 to step 1, then asked
 * to walk forward; LLM calls navigate_next(2) which sets step to 2).
 */
import pool from '../../db.js';

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

// Per-step data preconditions. Each entry: "if the user is leaving step N to
// advance to N+1, this field must exist". Returns the missing-field message,
// or null if the precondition passes. Back-nav (target_step <= current_step)
// is always allowed — we only check FORWARD advances.
function checkAdvanceData(args: {
  sourceStep: number;
  data: Record<string, unknown>;
  path: string | null;
  brainDumpRaw: string | null;
}): string | null {
  const { sourceStep, data, path, brainDumpRaw } = args;
  switch (sourceStep) {
    case 1:
      if (!data.nickname) return 'profile_missing: call submit_profile (nickname required) first';
      return null;
    case 2:
      if (!path) return 'path_missing: call submit_path_choice first';
      return null;
    case 3:
      // Beginner path uses category; advanced (braindump) path uses brain_dump_raw.
      if (!data.category && !(typeof brainDumpRaw === 'string' && brainDumpRaw.length > 0)) {
        return 'category_or_braindump_missing: call submit_category (beginner) or submit_brain_dump (advanced) first';
      }
      return null;
    case 4:
      if (!Array.isArray(data.goals) || data.goals.length === 0) {
        return 'goals_missing: call submit_goals first (with the chosen goals)';
      }
      return null;
    case 5: {
      const habits = data.habitConfigs as Record<string, unknown> | undefined;
      if (!habits || Object.keys(habits).length === 0) {
        return 'habits_missing: call add_habit at least once first';
      }
      return null;
    }
    case 6:
      if (!data.reflectionConfig) {
        return 'reflection_missing: call submit_reflection_config first';
      }
      return null;
    default:
      return null;
  }
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

  // Read current state for skip-check + data-precondition check. Both are
  // backend hard guards against the agent skipping steps / advancing before
  // the screen's data tool has fired. Prompt rules (RULE 7.5) already tell
  // the model to chain data_tool → navigate_next; this is the safety net.
  const existing = await pool.query<{
    current_step: number;
    data: Record<string, unknown> | null;
    path: string | null;
    brain_dump_raw: string | null;
  }>(
    `SELECT current_step, data, path, brain_dump_raw
       FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  const row = existing.rows[0];
  const currentStep = row?.current_step ?? 1;
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const path = row?.path ?? null;
  const brainDumpRaw = row?.brain_dump_raw ?? null;

  // Jumps beyond +2 are genuine skips → reject. Same step (re-render) and
  // back-nav are fine.
  if (targetStep > currentStep + 2) {
    console.log(
      `[vapi/tool] navigate_next rejected reason=cannot_skip_steps current=${currentStep} target=${targetStep}`,
    );
    return {
      error: `cannot_skip_steps: current_step=${currentStep}, target_step=${targetStep}. Advance one step at a time.`,
    };
  }

  // +2 is a tap/voice catch-up: tap-navigation into the current screen does NOT
  // bump current_step (only navigate_next does), so a subsequent voice advance
  // lands two ahead. Allow it ONLY when BOTH steps being left already have their
  // data saved; otherwise it's a real skip.
  if (targetStep === currentStep + 2) {
    for (let s = currentStep; s < targetStep; s++) {
      if (checkAdvanceData({ sourceStep: s, data, path, brainDumpRaw })) {
        console.log(
          `[vapi/tool] navigate_next rejected reason=cannot_skip_steps current=${currentStep} target=${targetStep}`,
        );
        return {
          error: `cannot_skip_steps: current_step=${currentStep}, target_step=${targetStep}. Advance one step at a time.`,
        };
      }
    }
  }

  // Single-step forward: verify the source step's data has been saved.
  if (targetStep === currentStep + 1) {
    const missing = checkAdvanceData({ sourceStep: currentStep, data, path, brainDumpRaw });
    if (missing) {
      console.log(
        `[vapi/tool] navigate_next rejected reason=precondition_not_met current=${currentStep} target=${targetStep} detail=${missing}`,
      );
      return { error: missing };
    }
  }

  // No GREATEST — explicitly set step to the LLM-supplied target. INSERT
  // path is defensive (onboarding_states row should already exist by the
  // time any tool fires); we seed with target_step too so a fresh row
  // matches the LLM's intent.
  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, updated_at)
     VALUES ($1, $2, 'in_progress', now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = $2,
       status = 'in_progress',
       updated_at = now()`,
    [anonId, targetStep],
  );

  console.log(
    `[vapi/tool] navigate_next written rows=${result.rowCount ?? 0} target_step=${targetStep}`,
  );
  return { result: 'ok' };
}
