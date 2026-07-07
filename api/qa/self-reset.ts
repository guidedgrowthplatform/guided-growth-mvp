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
 *   - DELETE FROM onboarding_states / user_habits / reflection_settings /
 *     chat_sessions / chat_messages / session_log  WHERE anon_id = <user>
 *   - UPDATE profiles SET onboarding fields = NULL  WHERE id = <user>
 * The auth.users + profiles rows survive, so the ACCOUNT stays, the DATA is wiped.
 *
 * reflection_settings and chat_sessions were added by the fresh-restart ruling
 * (2026-07): reflection_settings is where onboarding materializes reminder
 * time/days/mode/prompts AND The Weekly's day-of-week (weekly_day, migration
 * 055) on completion, and chat_sessions is the per-screen cold-open dedup
 * anchor onboarding chat writes (isOnboardingScreen in api/chat/[...path].ts).
 * Neither was cleared before, so a "fresh" re-walk could inherit a prior
 * round's reminder/weekly config, or resolve a stale chat_session_id for the
 * onboarding thread anchor even though its messages were already wiped. Both
 * only cascade from a full account delete, never from this scoped reset.
 * habit_completions is NOT listed explicitly: it FK-cascades off user_habits
 * (ON DELETE CASCADE), so deleting the habit rows already clears it.
 * This mirrors api/qa-reset.ts but scopes to the caller instead of an email body.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, handlePreflight } from '../_lib/auth.js';
import { refuseIfProd } from '../_lib/dbEnv.js';

const QA_EMAIL_PATTERN = /^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (refuseIfProd(res)) return;

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent 401/403

  const email = (user.email ?? '').toLowerCase().trim();
  if (!QA_EMAIL_PATTERN.test(email)) {
    return res
      .status(403)
      .json({ error: 'Not a QA account (must match qa-onboarding-*@guidedgrowth.test)' });
  }

  const { authUserId, anonId } = user;
  const deleted = {
    onboarding_states: 0,
    user_habits: 0,
    reflection_settings: 0,
    chat_sessions: 0,
    chat_messages: 0,
    session_log: 0,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (anonId) {
      const o = await client.query(`DELETE FROM onboarding_states WHERE anon_id = $1`, [anonId]);
      deleted.onboarding_states = o.rowCount ?? 0;
      const h = await client.query(`DELETE FROM user_habits WHERE anon_id = $1`, [anonId]);
      deleted.user_habits = h.rowCount ?? 0;
      const r = await client.query(`DELETE FROM reflection_settings WHERE anon_id = $1`, [anonId]);
      deleted.reflection_settings = r.rowCount ?? 0;
      const cs = await client.query(`DELETE FROM chat_sessions WHERE anon_id = $1`, [anonId]);
      deleted.chat_sessions = cs.rowCount ?? 0;
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
