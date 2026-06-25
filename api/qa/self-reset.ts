/**
 * POST /api/qa/self-reset
 *
 * QA-only. Resets the CURRENTLY AUTHENTICATED user's data, but ONLY when that
 * user is a dedicated QA test account whose email matches
 *   ^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$
 * Any real user is rejected with 403. No shared token is needed: the security
 * boundary is the authenticated session PLUS the QA email pattern, so the QA
 * control screen can call this right after signing in as a test user.
 *
 * Touches (and ONLY) the authed QA user:
 *   - DELETE FROM onboarding_states / user_habits / chat_messages / session_log  WHERE anon_id = <user>
 *   - UPDATE profiles SET onboarding fields = NULL  WHERE id = <user>
 * The auth.users + profiles rows survive, so the ACCOUNT stays, the DATA is wiped.
 * This mirrors api/qa-reset.ts but scopes to the caller instead of an email body.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, handlePreflight } from '../_lib/auth.js';

const QA_EMAIL_PATTERN = /^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent 401/403

  const email = (user.email ?? '').toLowerCase().trim();
  if (!QA_EMAIL_PATTERN.test(email)) {
    return res
      .status(403)
      .json({ error: 'Not a QA account (must match qa-onboarding-*@guidedgrowth.test)' });
  }

  const { authUserId, anonId } = user;
  const deleted = { onboarding_states: 0, user_habits: 0, chat_messages: 0, session_log: 0 };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (anonId) {
      const o = await client.query(`DELETE FROM onboarding_states WHERE anon_id = $1`, [anonId]);
      deleted.onboarding_states = o.rowCount ?? 0;
      const h = await client.query(`DELETE FROM user_habits WHERE anon_id = $1`, [anonId]);
      deleted.user_habits = h.rowCount ?? 0;
      const c = await client.query(`DELETE FROM chat_messages WHERE anon_id = $1`, [anonId]);
      deleted.chat_messages = c.rowCount ?? 0;
      const s = await client.query(`DELETE FROM session_log WHERE anon_id = $1`, [anonId]);
      deleted.session_log = s.rowCount ?? 0;
    }

    await client.query(
      `UPDATE profiles
         SET onboarding_path   = NULL,
             nickname          = NULL,
             age_group         = NULL,
             gender            = NULL,
             referral_source   = NULL
       WHERE id = $1`,
      [authUserId],
    );

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('[qa/self-reset] failed', err);
    return res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }

  console.info(
    JSON.stringify({
      event: 'qa_self_reset',
      email,
      anon_id_seen: anonId !== null,
      deleted,
      timestamp: new Date().toISOString(),
    }),
  );

  return res.status(200).json({ ok: true, reset: email, deleted });
}
