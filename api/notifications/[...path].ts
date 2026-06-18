import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { NotificationRecord } from '@gg/shared/types';
import pool from '../_lib/db.js';
import { requireUser, handlePreflight } from '../_lib/auth.js';
import { validateUUID } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  const user = await requireUser(req, res);
  if (!user) return;

  if (route === '' && req.method === 'GET') return listNotifications(req, res, user.anonId);
  if (route === 'register-token' && req.method === 'POST')
    return registerToken(req, res, user.anonId);
  if (route === 'read' && req.method === 'POST') return markRead(req, res, user.anonId);
  if (route === 'read-all' && req.method === 'POST') return markAllRead(req, res, user.anonId);

  return res.status(404).json({ error: 'Not found' });
}

async function listNotifications(_req: VercelRequest, res: VercelResponse, anonId: string) {
  const result = await pool.query<NotificationRecord>(
    `SELECT id, type, category, title, body, data, created_at, read_at
       FROM notifications
      WHERE anon_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [anonId],
  );
  return res.status(200).json({ notifications: result.rows });
}

async function registerToken(req: VercelRequest, res: VercelResponse, anonId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = body.token;
  const platform = body.platform;

  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
    return res.status(400).json({ error: 'valid token is required' });
  }
  if (platform !== 'ios' && platform !== 'android') {
    return res.status(400).json({ error: "platform must be 'ios' or 'android'" });
  }

  // device may change hands between accounts — token wins, anon_id follows
  await pool.query(
    `INSERT INTO device_tokens (anon_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
       SET anon_id = EXCLUDED.anon_id, last_seen_at = now()`,
    [anonId, token, platform],
  );
  return res.status(200).json({ ok: true });
}

async function markRead(req: VercelRequest, res: VercelResponse, anonId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = validateUUID(body.id);
  if (!id) return res.status(400).json({ error: 'valid id is required' });

  await pool.query(
    'UPDATE notifications SET read_at = now() WHERE anon_id = $1 AND id = $2 AND read_at IS NULL',
    [anonId, id],
  );
  return res.status(200).json({ ok: true });
}

async function markAllRead(_req: VercelRequest, res: VercelResponse, anonId: string) {
  await pool.query(
    'UPDATE notifications SET read_at = now() WHERE anon_id = $1 AND read_at IS NULL',
    [anonId],
  );
  return res.status(200).json({ ok: true });
}
