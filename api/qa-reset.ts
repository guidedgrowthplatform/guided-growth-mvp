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
 *   - DELETE FROM onboarding_states WHERE user_id = <qa user>
 *   - DELETE FROM user_habits      WHERE user_id = <qa user>
 *   - UPDATE profiles SET onboarding-related fields = NULL WHERE user_id = <qa user>
 *
 * Auth: bearer token via Authorization header, value = process.env.QA_RESET_TOKEN.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';

const QA_EMAIL_PATTERN = /^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$/;
const DEFAULT_QA_EMAIL = 'qa-onboarding-fresh@guidedgrowth.test';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify bearer token
  const token = (req.headers['authorization'] ?? '').toString().replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.QA_RESET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Resolve the target email and enforce the QA-only guard
  const email = (req.body?.email ?? DEFAULT_QA_EMAIL).toString().toLowerCase().trim();
  if (!QA_EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Email is not a QA account (must match qa-onboarding-*@guidedgrowth.test)' });
  }

  const client = await pool.connect();
  try {
    // Look up the user row (matches auth.users.id) AND the profile's anon_id.
    // Per migration 025_anon_id, onboarding_states + user_habits use anon_id, not user_id.
    // profiles itself still keys on id (= auth.users.id).
    const { rows: userRows } = await client.query<{ user_id: string; anon_id: string | null }>(
      `SELECT au.id AS user_id, p.anon_id
         FROM auth.users au
         LEFT JOIN profiles p ON p.id = au.id
        WHERE au.email = $1`,
      [email]
    );
    if (!userRows.length) {
      return res.status(404).json({ error: `QA user ${email} not found` });
    }
    const { user_id: userId, anon_id: anonId } = userRows[0];

    // Only delete onboarding-state + habits if we have an anon_id (profile exists).
    // If the user never finished signup-to-profile linkage, anon_id can be null —
    // in that case there's nothing to clean up in those tables anyway.
    if (anonId) {
      await client.query(`DELETE FROM onboarding_states WHERE anon_id = $1`, [anonId]);
      await client.query(`DELETE FROM user_habits WHERE anon_id = $1`, [anonId]);
    }

    // profiles keeps id as the auth.users FK; we just NULL the onboarding-related fields.
    await client.query(
      `UPDATE profiles
         SET onboarding_path   = NULL,
             nickname          = NULL,
             age_group         = NULL,
             gender            = NULL,
             referral_source   = NULL
       WHERE id = $1`,
      [userId]
    );

    return res.status(200).json({ ok: true, reset: email, anon_id_seen: anonId !== null });
  } catch (err: any) {
    console.error('[qa-reset] error:', err);
    // QA endpoint — surface the underlying error so we can diagnose without Vercel logs.
    // Auth + regex guard upstream make this safe (only QA accounts can ever reach this).
    return res.status(500).json({
      error: 'Reset failed',
      message: err?.message ?? String(err),
      code: err?.code,
      detail: err?.detail,
      hint: err?.hint,
      where: err?.where,
    });
  } finally {
    client.release();
  }
}
