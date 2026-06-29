/**
 * remove_habit handler — removes a habit (by case-insensitive name match)
 * from onboarding_states.data.habitConfigs.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Idempotent: if no row or no matching key, returns ok without erroring.
 * current_step is NOT bumped — removing a habit shouldn't advance progress.
 */
import pool, { type Queryable } from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX_LEN = 100;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export async function removeHabit(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=remove_habit anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const nameRaw = getString(args, 'name');
  if (nameRaw === undefined || nameRaw.trim().length === 0) {
    console.log('[vapi/tool] validation_failed reason=name_required');
    return { error: 'validation_failed: name is required' };
  }
  if (nameRaw.length > NAME_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=name_too_long');
    return { error: `validation_failed: name must be at most ${NAME_MAX_LEN} characters` };
  }

  const target = nameRaw.trim().toLowerCase();

  // Read current habitConfigs to find a case-insensitive key match.
  const existingRes = await db.query<{ hc: Record<string, unknown> | null }>(
    `SELECT data->'habitConfigs' AS hc FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );

  const hc = existingRes.rows[0]?.hc;
  if (!hc || typeof hc !== 'object') {
    // No state or no habits — nothing to remove, idempotent success.
    console.log('[vapi/tool] remove_habit written rows=0 reason=no_habits');
    return { result: 'ok' };
  }

  const keys = Object.keys(hc);
  const matchKey = keys.find((k) => k.toLowerCase() === target);
  if (!matchKey) {
    console.log('[vapi/tool] remove_habit written rows=0 reason=key_not_found');
    return { result: 'ok' };
  }

  const result = await db.query(
    `UPDATE onboarding_states
     SET data = jsonb_set(data, '{habitConfigs}', (data->'habitConfigs') - $2::text),
         updated_at = now()
     WHERE anon_id = $1`,
    [anonId, matchKey],
  );

  console.log(`[vapi/tool] remove_habit written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
