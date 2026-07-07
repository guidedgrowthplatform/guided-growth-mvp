import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { PATH_OPTIONS } from '../schemas.js';
import { getString, handlerError, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

function isPathOption(v: string): boolean {
  return (PATH_OPTIONS as readonly string[]).includes(v);
}

// Grounding guard (G13): the submitted path must trace to the user's own
// stated preference, not a model choice on a delegation/skip turn ("pick for
// me", "skip this too", "you decide"). Pattern mirrors recordCheckin's
// isCheckinGrounded and setupConfigGuard: disabled when user_text is absent
// (backward-compatible Vapi webhook parity), permissive on bare affirmations
// (coach may have just proposed a specific path by name and the user said
// "yes" -- that is real consent, not delegation).
//
// A turn is grounded when it contains at least ONE of:
//   (a) a bare affirmation -- user confirming a coach-proposed path
//   (b) a simple/beginner path signal -- "new", "beginner", "guided", ...
//   (c) a braindump/advanced path signal -- "already track", "brain dump", ...
//   (d) negation of having done it before -- "never", "haven't", "first time"
//       (these reliably map to simple, system-prompt rule 1)
//
// A delegation turn is explicitly ungrounded: "pick for me", "just choose",
// "skip", "you decide", "doesn't matter". These hit the rejection path even
// if they also happen to contain a grounding word via the delegation check
// running FIRST (conservative: reject over pass on ambiguous overlap).

const AFFIRMATION_RE =
  /\b(yes|yeah|yep|yup|sure|sounds good|works for me|that works|ok(?:ay)?|perfect|great|let'?s do (?:it|that)|go for it|do it)\b/i;

// Delegation phrases that prove the user is NOT choosing -- they're asking the
// model to pick for them. Conservative list: only unambiguous delegation
// signals that can't be path content ("skip" alone is ambiguous in long turns,
// but "skip this" / "pick one for me" / "you decide" are not).
const DELEGATION_RE =
  /\b(pick (?:one|it|a path|for me)|you (?:decide|choose|pick)|doesn'?t matter(?: to me)?|i (?:don'?t care|dont care)|just (?:pick|choose|decide|go ahead)|skip (?:this|it|the (?:question|path|choice))|choose for me)\b/i;

// Path-signal vocabulary. Kept deliberately broad -- grounding only needs to
// confirm "the turn said something path-shaped", not validate the exact value.
// The model's path argument does the actual routing; the guard just blocks
// turns that had no path signal at all.
const SIMPLE_PATH_RE =
  /\b(new|beginner|guided|simple|easy|first time|never (?:tracked|done|tried|used)|haven'?t(?: really| been)?(?: tracked| done| tried)?|no(?: i haven'?t| i have not| not really)?|structured|not sure(?: yet)?|don'?t know(?: yet)?|starting out|just starting|recommend(?:ed)?(?: (?:one|me|the easy|beginner))?)\b/i;

const BRAINDUMP_RE =
  /\b(brain ?dump|already (?:track|have|doing|do|know)|advanced|i (?:track|have|know what i want)|data|habits? i(?:'ve| have)(?: already| been)?(?: built| done| track)|experience[d]?|been (?:tracking|doing)|i'?ve (?:got|been|done)|existing habits?)\b/i;

// True when the turn carries a grounded path preference (affirmation, a path
// signal, or prior-experience negation). False when it's pure delegation or
// has no path-shaped content at all.
export function isPathChoiceGrounded(userText: string): boolean {
  const t = userText.toLowerCase();
  // Delegation check first -- overrides all other signals.
  if (DELEGATION_RE.test(t)) return false;
  return AFFIRMATION_RE.test(t) || SIMPLE_PATH_RE.test(t) || BRAINDUMP_RE.test(t);
}

export async function submitPathChoice(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const path = getString(args, 'path');
  if (path === undefined || path.length === 0) {
    return invalid('path is required');
  }
  if (!isPathOption(path)) {
    return invalid(`path must be one of ${PATH_OPTIONS.join(', ')}`);
  }

  // Grounding guard: runs before the DB write. Disabled when user_text is
  // absent (same backward-compatible convention as addHabit and recordCheckin).
  if (ctx.user_text && !isPathChoiceGrounded(ctx.user_text)) {
    return handlerError('path_choice_not_grounded');
  }

  const result = await pool.query<{
    data: Record<string, unknown>;
    current_step: number;
    path: string;
  }>(
    `INSERT INTO onboarding_states (anon_id, current_step, path, status, data, updated_at)
     VALUES ($1, 2, $2, 'in_progress', '{}'::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       path = $2,
       status = 'in_progress',
       updated_at = now()
     RETURNING data, current_step, path`,
    [ctx.anon_id, path],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? {},
    current_step: row?.current_step ?? 2,
    path: row?.path ?? path,
  });
}
