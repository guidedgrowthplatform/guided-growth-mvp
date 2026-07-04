/**
 * weekly_archive_habit handler — the "drop it" move during The Weekly.
 * Soft delete: is_active = false, archived_at = now(). History stays, never
 * hard-deletes. Logic ported from api/_lib/llm/checkin/handlers/deleteHabit.ts,
 * adapted to the Vapi handler shape (anon_id injected via args).
 *
 * Auth model: see ../../vapi/handlers/submitProfile.ts. Channel auth is
 * X-Vapi-Secret; identity arrives as `anon_id` injected by Vapi from static
 * call params.
 */
import pool, { type Queryable } from '../../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// Strip articles + trailing "habit(s)"/"please" so spoken names match stored
// (ILIKE). Mirrors api/_lib/llm/checkin/handlers/shared.ts normalizeVoiceName.
function normalizeVoiceName(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:the|my|a|an)\s+/i, '')
    .replace(/\s+(?:please|thanks?|thank you)$/i, '')
    .replace(/\s+habits?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function weeklyArchiveHabit(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log(
    '[vapi/tool] received name=weekly_archive_habit anon_id=' + getString(args, 'anon_id'),
  );

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const rawName = getString(args, 'name');
  if (!rawName || rawName.trim().length === 0) {
    console.log('[vapi/tool] validation_failed reason=name_required');
    return { error: 'validation_failed: name is required' };
  }
  const name = normalizeVoiceName(rawName);

  const found = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM user_habits
      WHERE anon_id = $1 AND name ILIKE $2 AND is_active = true AND archived_at IS NULL
      LIMIT 1`,
    [anonId, name],
  );
  const habit = found.rows[0];
  if (!habit) {
    console.log('[vapi/tool] not_found reason=habit_not_found');
    return { error: `not_found: No habit called "${name}".` };
  }

  const result = await db.query(
    `UPDATE user_habits SET is_active = false, archived_at = now() WHERE id = $1 AND anon_id = $2`,
    [habit.id, anonId],
  );

  console.log(`[vapi/tool] weekly_archive_habit written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
