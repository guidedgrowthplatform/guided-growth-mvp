/**
 * POST /api/qa-reset
 *
 * Scoped QA-only endpoint. Resets onboarding state for the single
 * dedicated test account so MobAI-driven test runs can start fresh
 * without manual SQL intervention.
 *
 * What it touches (and ONLY what it touches):
 *   - DELETE FROM onboarding_states WHERE user_id = <qa user>
 *   - DELETE FROM user_habits      WHERE user_id = <qa user>
 *   - UPDATE profiles SET onboarding-related fields = NULL WHERE user_id = <qa user>
 *
 * It cannot touch any other user or any other table.
 * Guarded by a secret bearer token stored in Vercel env (QA_RESET_TOKEN).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';

const QA_EMAIL = 'qa-onboarding-01@guidedgrowth.test';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify bearer token
  const token = (req.headers['authorization'] ?? '').toString().replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.QA_RESET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  try {
    // Look up the QA user — hardcoded email is the only safety net we need
    const { rows: userRows } = await client.query<{ id: string }>(
      `SELECT id FROM auth.users WHERE email = $1`,
      [QA_EMAIL]
    );
    if (!userRows.length) {
      return res.status(404).json({ error: `QA user ${QA_EMAIL} not found` });
    }
    const userId = userRows[0].id;

    // Clear onboarding state
    await client.query(`DELETE FROM onboarding_states WHERE user_id = $1`, [userId]);

    // Clear habits created during onboarding
    await client.query(`DELETE FROM user_habits WHERE user_id = $1`, [userId]);

    // Reset profile onboarding fields only (keep the profile row itself)
    await client.query(
      `UPDATE profiles
         SET onboarding_path   = NULL,
             nickname          = NULL,
             age_group         = NULL,
             gender            = NULL,
             referral_source   = NULL
       WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({ ok: true, reset: QA_EMAIL });
  } catch (err) {
    console.error('[qa-reset] error:', err);
    return res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }
}
