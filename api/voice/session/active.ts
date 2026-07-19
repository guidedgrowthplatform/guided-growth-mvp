import type { VercelRequest, VercelResponse } from '@vercel/node';
import { acknowledgeCoachHostActive } from '../../_lib/voice/coachHost.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.COACH_COMPONENT_ENABLED !== 'true')
    return res.status(404).json({ error: 'Not found' });
  const authorization = req.headers.authorization;
  const capability = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const sessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
  if (typeof sessionId !== 'string' || !capability)
    return res.status(401).json({ error: 'invalid_capability' });
  const active = await acknowledgeCoachHostActive(sessionId, capability);
  return active
    ? res.status(200).json({ active: true })
    : res.status(403).json({ error: 'invalid_capability' });
}
