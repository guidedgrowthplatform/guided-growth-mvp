import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, requireUser } from '../../_lib/auth.js';
import pool from '../../_lib/db.js';
import { endCoachSessionOnHost } from '../../_lib/voice/coachHost.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.COACH_COMPONENT_ENABLED !== 'true')
    return res.status(404).json({ error: 'Not found' });
  const user = await requireUser(req, res);
  if (!user) return;
  const sessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
  if (typeof sessionId !== 'string') return res.status(400).json({ error: 'invalid_session_id' });

  const result = await pool.query<{ id: string; state: string }>(
    `UPDATE coach_sessions
        SET state = 'ended', ended_at = COALESCE(ended_at, now()), terminal_reason = COALESCE(terminal_reason, 'client_end')
      WHERE id = $1 AND anon_id = $2 AND state IN ('creating', 'spawning', 'active')
      RETURNING id, state`,
    [sessionId, user.anonId],
  );
  if (result.rows[0]) {
    await endCoachSessionOnHost(sessionId);
    return res.status(200).json({ ended: true, alreadyEnded: false });
  }

  const existing = await pool.query<{ anon_id: string; state: string }>(
    'SELECT anon_id, state FROM coach_sessions WHERE id = $1',
    [sessionId],
  );
  if (!existing.rows[0] || existing.rows[0].anon_id !== user.anonId)
    return res.status(404).json({ error: 'session_not_found' });
  return res.status(200).json({ ended: true, alreadyEnded: true });
}
