import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getNumber, handlerError, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

// Persist the state-check result (sleep, mood, energy, stress) from the
// state-check beat. Mirrors submitMorningCheckin: merge-upsert into
// onboarding_states.data.stateCheck, GREATEST-bump current_step to the beat's
// V3 persist step (6) — same semantics as the tap save path, so a voice save
// survives a refresh identically to a tap.
//
// TODO(finalize: map onboarding stateCheck -> daily_checkins at onboarding-complete)

// Grounding guard (G12): each submitted value must trace to something the
// user actually said this turn, not a silent default or a fabrication from
// an off-topic / skip-shaped reply ("speed this up" produced sleep:5 + others;
// a reminders-only turn produced 4 fabricated values — two corroborations
// across three rounds).
//
// Pattern mirrors setupConfigGuard (B58 / !478): guard disabled when user_text
// is absent/empty (backward-compatible, same as addHabit's looksUngrounded and
// setupConfigGuard's convention). When present, the turn must carry either:
//   (a) a 1-5 digit that plausibly anchors a rating,
//   (b) a state-check word (sleep, energy, mood, stress, tired, great, …), or
//   (c) a bare affirmation of a coach-proposed assessment (same permissive
//       affirmation logic as setupConfigGuard's leg 2).
// Any turn that fails all three legs is ungrounded → rejects with
// handler_error / checkin_not_grounded; nothing is written.
//
// Refusal semantics are NOT modeled: setupConfigGuard.ts covers explicit
// surface-refusal ("don't want the morning check-in") because those surfaces
// are setup-config tools with stable opt-out semantics. record_checkin is a
// data-capture tool; a user who truly wants to skip this beat uses the advance
// tool. An off-topic turn here is grounding failure, not refusal.

const RATING_RE = /\b[1-5]\b/;

// State-check vocabulary. Deliberately broad — the guard only needs to tell
// "said something state-check-shaped" from "said nothing state-check-shaped",
// not validate the value. Exact validation is handled above by the 1-5 range
// check.
const STATE_WORD_RE =
  /\b(sleep|slept|sleeping|mood|energy|energized|stress|stressed|stressful|tired|exhausted|rested|refreshed|anxious|anxiety|calm|calm|ok(?:ay)?|alright|great|good|bad|terrible|awful|rough|solid|fine|wired|drained|low|high|awful|meh)\b/i;

const AFFIRMATION_RE =
  /\b(yes|yeah|yep|yup|sure|sounds good|works for me|that works|ok(?:ay)?|perfect|great|let'?s do (?:it|that)|go for it|do it)\b/i;

function isCheckinGrounded(userText: string): boolean {
  const t = userText.toLowerCase();
  return RATING_RE.test(t) || STATE_WORD_RE.test(t) || AFFIRMATION_RE.test(t);
}

const DIMS = ['sleep', 'mood', 'energy', 'stress'] as const;

export async function recordCheckin(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // Grounding guard: runs before field validation so an ungrounded call is
  // rejected without touching the DB, regardless of what values the model
  // supplied. Disabled when user_text is absent (same backward-compatible
  // convention as addHabit and setupConfigGuard).
  if (ctx.user_text && !isCheckinGrounded(ctx.user_text)) {
    return handlerError('checkin_not_grounded');
  }

  const values: Record<string, number> = {};
  for (const dim of DIMS) {
    const v = getNumber(args, dim);
    if (v !== undefined) {
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        return invalid(`${dim} must be an integer 1-5`);
      }
      values[dim] = v;
    }
  }

  if (Object.keys(values).length === 0) {
    return invalid('at least one dimension (sleep, mood, energy, stress) is required');
  }

  const payload = JSON.stringify({ stateCheck: values });

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 6, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 6),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { stateCheck: values },
    current_step: row?.current_step ?? 6,
    stateCheck: values,
  });
}
