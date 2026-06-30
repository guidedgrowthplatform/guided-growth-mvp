// POST /api/qa/reset-checkin — QA-only. Deletes the caller's check-in rows for
// today (own anon_id + today) so the flow can be redone. Gated to non-prod, or
// QA_CHECKIN_RESET_ENABLED=true for a prod-type staging deploy.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, requireUser } from '../_lib/auth.js';
import pool from '../_lib/db.js';
import { todayStr } from '../_lib/llm/checkin/handlers/shared.js';
import { validateTimezone } from '../_lib/validation.js';

const ENABLED =
  process.env.VERCEL_ENV !== 'production' || process.env.QA_CHECKIN_RESET_ENABLED === 'true';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ENABLED) return res.status(403).json({ error: 'QA check-in reset disabled' });

  const user = await requireUser(req, res);
  if (!user) return;
  const { anonId } = user;
  if (!anonId) return res.status(400).json({ error: 'No anon_id for user' });

  const timezone = validateTimezone((req.body as { timezone?: unknown })?.timezone) ?? 'UTC';
  const today = todayStr(timezone);

  const client = await pool.connect();
  const deleted: Record<string, number> = {};
  try {
    await client.query('BEGIN');
    for (const table of ['daily_checkins', 'habit_completions', 'journal_entries']) {
      const r = await client.query(`DELETE FROM ${table} WHERE anon_id = $1 AND date = $2`, [
        anonId,
        today,
      ]);
      deleted[table] = r.rowCount ?? 0;
    }
    await client.query('COMMIT');
  } catch {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }

  return res.status(200).json({ ok: true, date: today, deleted });
}
