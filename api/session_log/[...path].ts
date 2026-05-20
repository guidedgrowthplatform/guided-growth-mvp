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

  // Optional client-generated UUID enables idempotent retries from the
  // optimistic local sessionLogStore. ON CONFLICT relies on the PK's UNIQUE
  // constraint on `id`. If omitted, the column DEFAULT generates one server-side.
  let clientId: string | null = null;
  if (body.id !== undefined && body.id !== null) {
    if (
      typeof body.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
    ) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }
    clientId = body.id;
  }

  const sql = clientId
    ? `INSERT INTO session_log (id, anon_id, session_id, event_type, screen_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, timestamp`
    : `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, timestamp`;
  const params = clientId
    ? [clientId, user.anonId, sessionId, eventType, screenId, payload]
    : [user.anonId, sessionId, eventType, screenId, payload];

  const result = await pool.query<{ id: string; timestamp: Date }>(sql, params);

  // ON CONFLICT DO NOTHING returns zero rows when the id was already inserted.
  // Treat as idempotent success — the row exists with the requested id.
  if (result.rows.length === 0 && clientId) {
    return res.status(200).json({ id: clientId, timestamp: null, deduped: true });
  }

  const row = result.rows[0];
  return res.status(201).json({ id: row.id, timestamp: row.timestamp });
}
