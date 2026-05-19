import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, handlePreflight } from './_lib/auth.js';

// Returns the authenticated caller's anon_id + first name. The frontend uses
// anon_id as the PostHog/Sentry identifier (no PII attached). anon_id is NOT
// surfaced via the JWT/Supabase user object on purpose — it's an app-domain
// concept resolved via profiles, not auth metadata.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = await requireUser(req, res);
  if (!user) return;

  return res.json({
    authUserId: user.authUserId,
    anonId: user.anonId,
    firstName: user.firstName,
    role: user.role,
  });
}
