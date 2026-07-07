/**
 * submit_weekly_config handler — writes the user's chosen day for The Weekly
 * (their weekly coaching session) to onboarding_states.data.weeklyConfig on
 * ONBOARD-WEEKLY-SETUP.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Validation pattern mirrors submitReflectionConfig (day is the same 0-6 int
 * shape as its `days` array items, just a single value here).
 *
 * B58 scope note: see the same note in ./submitMorningCheckin.ts. The
 * sibling onboarding-lane handler's server-side refusal/grounding guard is
 * not ported here because the Vapi webhook payload never carries the raw
 * user turn text this guard needs.
 */
import pool, { type Queryable } from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// GPT-family drift: numeric schemas sometimes arrive as numeric strings.
function getNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return parseInt(v, 10);
  return undefined;
}

export async function submitWeeklyConfig(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log(
    '[vapi/tool] received name=submit_weekly_config anon_id=' + getString(args, 'anon_id'),
  );

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const day = getNumber(args, 'day');
  if (day === undefined || !Number.isInteger(day) || day < 0 || day > 6) {
    console.log('[vapi/tool] validation_failed reason=day_out_of_range');
    return { error: 'validation_failed: day must be an integer 0-6' };
  }

  const weeklyConfig = { day };
  const payload = JSON.stringify({ weeklyConfig });

  // DATA ONLY — current_step not touched on UPDATE; navigate_next handles the
  // screen advance. INSERT path defaults to step 9 (weekly-day-setup); it is a
  // fallback only — by this beat a row already exists from prior steps.
  const result = await db.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 9, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, payload],
  );

  console.log(`[vapi/tool] submit_weekly_config written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
