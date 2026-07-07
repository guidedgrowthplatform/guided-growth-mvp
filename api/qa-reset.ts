/**
 * POST /api/qa-reset
 *
 * Scoped QA-only endpoint. Resets onboarding state for the dedicated
 * test accounts so MobAI-driven test runs can start fresh without
 * manual SQL intervention.
 *
 * Request body (optional): { "email": "qa-onboarding-fresh@guidedgrowth.test" }
 * Defaults to "qa-onboarding-fresh@guidedgrowth.test" when omitted.
 *
 * SAFETY: the email is guarded by a strict regex — only addresses matching
 *   ^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$
 * are accepted. ANY other email (real users, admin users, etc.) is rejected
 * with 400. The guard is the security boundary, not the default value.
 *
 * What it touches (and ONLY what it touches) for the matched user:
 *   - DELETE FROM onboarding_states    WHERE anon_id = <qa user>
 *   - DELETE FROM user_habits          WHERE anon_id = <qa user>
 *   - DELETE FROM reflection_settings  WHERE anon_id = <qa user>
 *   - DELETE FROM chat_sessions        WHERE anon_id = <qa user>
 *   - DELETE FROM chat_messages        WHERE anon_id = <qa user>
 *   - DELETE FROM session_log          WHERE anon_id = <qa user>
 *   - UPDATE profiles SET onboarding-related fields = NULL WHERE id = <qa user>
 *
 * reflection_settings and chat_sessions were added by the fresh-restart ruling
 * (2026-07), see api/qa/self-reset.ts's doc comment for why: reflection_settings
 * holds the reminder time/days/mode/prompts AND The Weekly's day-of-week that
 * onboarding materializes on completion, and chat_sessions is the onboarding
 * chat's cold-open dedup anchor. Both used to survive a reset and leak into
 * the next "fresh" walk. habit_completions FK-cascades off user_habits, so it
 * needs no explicit delete here.
 *
 * Auth: bearer token via Authorization header, value = process.env.QA_RESET_TOKEN.
 * Rate-limited at 10 requests/hour per source IP.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';
import { refuseIfProd } from './_lib/dbEnv.js';

const QA_EMAIL_PATTERN = /^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$/;
const DEFAULT_QA_EMAIL = 'qa-onboarding-fresh@guidedgrowth.test';

type DeletedCounts = {
  onboarding_states: number;
  user_habits: number;
  reflection_settings: number;
  chat_sessions: number;
  chat_messages: number;
  session_log: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (refuseIfProd(res)) return;

  const sourceIp = getClientIp(req.headers);

  // 10/hr per-IP cap — generous for MobAI runs, low enough to neuter abuse.
  const rl = checkRateLimit(sourceIp, {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'qa-reset-ip',
  });
  if (rl.limited) {
    if (rl.retryAfter !== undefined) res.setHeader('Retry-After', String(rl.retryAfter));
    console.info(
      JSON.stringify({
        event: 'qa_reset',
        source_ip: sourceIp,
        success: false,
        reason: 'rate_limited',
        retry_after: rl.retryAfter,
        timestamp: new Date().toISOString(),
      }),
    );
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const token = (req.headers['authorization'] ?? '').toString().replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.QA_RESET_TOKEN) {
    console.info(
      JSON.stringify({
        event: 'qa_reset',
        source_ip: sourceIp,
        success: false,
        reason: 'unauthorized',
        timestamp: new Date().toISOString(),
      }),
    );
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = (req.body?.email ?? DEFAULT_QA_EMAIL).toString().toLowerCase().trim();
  if (!QA_EMAIL_PATTERN.test(email)) {
    console.info(
      JSON.stringify({
        event: 'qa_reset',
        source_ip: sourceIp,
        success: false,
        reason: 'invalid_email',
        timestamp: new Date().toISOString(),
      }),
    );
    return res
      .status(400)
      .json({ error: 'Email is not a QA account (must match qa-onboarding-*@guidedgrowth.test)' });
  }

  const client = await pool.connect();
  const deleted: DeletedCounts = {
    onboarding_states: 0,
    user_habits: 0,
    reflection_settings: 0,
    chat_sessions: 0,
    chat_messages: 0,
    session_log: 0,
  };
  try {
    await client.query('BEGIN');

    const { rows: userRows } = await client.query<{ user_id: string; anon_id: string | null }>(
      `SELECT au.id AS user_id, p.anon_id
         FROM auth.users au
         LEFT JOIN profiles p ON p.id = au.id
        WHERE au.email = $1`,
      [email],
    );
    if (!userRows.length) {
      await client.query('ROLLBACK');
      console.info(
        JSON.stringify({
          event: 'qa_reset',
          source_ip: sourceIp,
          success: false,
          reason: 'user_not_found',
          email,
          timestamp: new Date().toISOString(),
        }),
      );
      return res.status(404).json({ error: `QA user ${email} not found` });
    }
    const { user_id: userId, anon_id: anonId } = userRows[0];

    if (anonId) {
      const onboarding = await client.query(`DELETE FROM onboarding_states WHERE anon_id = $1`, [
        anonId,
      ]);
      deleted.onboarding_states = onboarding.rowCount ?? 0;

      const habits = await client.query(`DELETE FROM user_habits WHERE anon_id = $1`, [anonId]);
      deleted.user_habits = habits.rowCount ?? 0;

      const reflection = await client.query(`DELETE FROM reflection_settings WHERE anon_id = $1`, [
        anonId,
      ]);
      deleted.reflection_settings = reflection.rowCount ?? 0;

      const chatSessions = await client.query(`DELETE FROM chat_sessions WHERE anon_id = $1`, [
        anonId,
      ]);
      deleted.chat_sessions = chatSessions.rowCount ?? 0;

      const chats = await client.query(`DELETE FROM chat_messages WHERE anon_id = $1`, [anonId]);
      deleted.chat_messages = chats.rowCount ?? 0;

      const sessionLog = await client.query(`DELETE FROM session_log WHERE anon_id = $1`, [anonId]);
      deleted.session_log = sessionLog.rowCount ?? 0;
    }

    await client.query(
      `UPDATE profiles
         SET onboarding_path   = NULL,
             nickname          = NULL,
             age_group         = NULL,
             gender            = NULL,
             referral_source   = NULL
       WHERE id = $1`,
      [userId],
    );

    await client.query('COMMIT');

    console.info(
      JSON.stringify({
        event: 'qa_reset',
        source_ip: sourceIp,
        success: true,
        email,
        anon_id_seen: anonId !== null,
        deleted,
        timestamp: new Date().toISOString(),
      }),
    );

    return res.status(200).json({ ok: true, reset: email, anon_id_seen: anonId !== null, deleted });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors — original error is what matters
    }
    const e = err as {
      message?: string;
      code?: string;
      detail?: string;
      hint?: string;
      where?: string;
    };
    console.error('[qa-reset] error:', err);
    console.info(
      JSON.stringify({
        event: 'qa_reset',
        source_ip: sourceIp,
        success: false,
        reason: 'exception',
        error_code: e.code,
        error_message: e.message,
        timestamp: new Date().toISOString(),
      }),
    );
    return res.status(500).json({
      error: 'Reset failed',
      message: e.message ?? String(err),
      code: e.code,
      detail: e.detail,
      hint: e.hint,
      where: e.where,
    });
  } finally {
    client.release();
  }
}
