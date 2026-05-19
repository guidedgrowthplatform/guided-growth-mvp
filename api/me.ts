import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, handlePreflight } from './_lib/auth.js';

// Returns the authenticated caller's anon_id + first name. Frontend uses
// anon_id as the PostHog/Sentry identifier. authUserId is NOT surfaced —
// the frontend already has it via supabase.auth.getSession(), and shipping
// both in one response invites breadcrumb re-linking.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = await requireUser(req, res);
  if (!user) return;

  return res.json({
    anonId: user.anonId,
    firstName: user.firstName,
    role: user.role,
  });
}
