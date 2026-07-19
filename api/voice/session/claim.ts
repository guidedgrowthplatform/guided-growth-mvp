import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../../_lib/db.js';
import { verifyCapability } from '../../_lib/voice/coachBroker.js';

function hostAuthorized(req: VercelRequest): boolean {
  const expected = process.env.COACH_HOST_CONTROL_SECRET;
  return Boolean(expected && req.headers['x-coach-host-control'] === expected);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.COACH_COMPONENT_ENABLED !== 'true' || !hostAuthorized(req))
    return res.status(404).json({ error: 'Not found' });

  const capability = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const sessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
  const claims = capability && typeof sessionId === 'string' ? verifyCapability(capability) : null;
  if (!claims || claims.sessionId !== sessionId)
    return res.status(401).json({ error: 'invalid_capability' });

  const result = await pool.query(
    `UPDATE coach_sessions
       SET state = 'spawning'
     WHERE id = $1 AND anon_id = $2 AND screen_id = $3 AND capability_jti = $4 AND state = 'creating'
     RETURNING id`,
    [sessionId, claims.anonId, claims.screenId, claims.jti],
  );
  return result.rowCount === 1
    ? res.status(200).json({ claimed: true })
    : res.status(409).json({ error: 'capability_already_claimed' });
}
