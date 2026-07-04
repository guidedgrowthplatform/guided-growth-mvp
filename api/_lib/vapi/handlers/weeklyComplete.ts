/**
 * weekly_complete handler — locks next week's plan and closes The Weekly
 * session. Call once, at the close beat, after the recap.
 *
 * Writes to weekly_sessions (supabase/migrations/055_the_weekly.sql):
 * upserts on (anon_id, week_end) so a second call in the same week updates
 * rather than duplicates. `changes` stays '[]' for MVP — the edit trail can
 * be reconstructed from the vapi_tool_calls ledger (each weekly_update_habit /
 * weekly_archive_habit / weekly_add_habit call this session made is already
 * durably recorded there, keyed by tool_call_id).
 *
 * "Today" is resolved server-side via CURRENT_DATE, matching the rest of the
 * Vapi onboarding handlers (e.g. navigateNext.ts), which have no per-call
 * timezone argument — Vapi's static call params only carry anon_id/session_id
 * (see scripts/vapi-sync/wrap.ts). week_start = today - 6 (a 7-day window
 * ending today inclusive), mirroring api/_lib/weekly/weekData.ts's
 * windowDates().
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

export async function weeklyComplete(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=weekly_complete anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const focusRaw = getString(args, 'focus');
  const focus = focusRaw !== undefined ? focusRaw.trim().slice(0, 500) : null;

  const result = await db.query(
    `INSERT INTO weekly_sessions (anon_id, week_start, week_end, completed_at, focus)
     VALUES ($1, CURRENT_DATE - 6, CURRENT_DATE, now(), $2)
     ON CONFLICT (anon_id, week_end) DO UPDATE SET
       completed_at = now(),
       focus = COALESCE($2, weekly_sessions.focus)
     RETURNING id`,
    [anonId, focus],
  );

  console.log(`[vapi/tool] weekly_complete written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
