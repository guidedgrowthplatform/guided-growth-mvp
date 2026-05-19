import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { isSessionLogEvent } from '../_lib/session-log-events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  if (route !== '') return res.status(404).json({ error: 'Not found' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body ?? {}) as Record<string, unknown>;

  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    return res.status(400).json({ error: 'session_id is required' });
  }

  if (!isSessionLogEvent(body.event_type)) {
    return res.status(400).json({ error: 'invalid event_type' });
  }
  const eventType = body.event_type;

  let screenId: string | null = null;
  if (body.screen_id !== undefined && body.screen_id !== null) {
    if (typeof body.screen_id !== 'string') {
      return res.status(400).json({ error: 'screen_id must be a string' });
    }
    screenId = body.screen_id;
  }

  let payload: Record<string, unknown> | null = null;
  if (body.payload !== undefined && body.payload !== null) {
    if (typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return res.status(400).json({ error: 'payload must be an object' });
    }
    payload = body.payload as Record<string, unknown>;
  }

  const result = await pool.query<{ id: string; timestamp: Date }>(
    `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, timestamp`,
    [user.anonId, sessionId, eventType, screenId, payload],
  );

  const row = result.rows[0];
  return res.status(201).json({ id: row.id, timestamp: row.timestamp });
}
