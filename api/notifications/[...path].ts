import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildNotificationContent, SESSION_EXPIRED_WINDOW_MS } from '@gg/shared';
import type { NotificationRecord } from '@gg/shared/types';
import { requireUser, handlePreflight } from '../_lib/auth.js';
import pool from '../_lib/db.js';
import { getFcm, pruneDeadTokens, sendPush } from '../_lib/firebase.js';
import { isSessionExpiredEligible } from '../_lib/sessionExpiry.js';
import { validateUUID } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // cron authenticates via CRON_SECRET (not a user JWT) → before requireUser
  if (route === 'cron') return handleCron(req, res);

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

function secretMatches(token: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface LapsedDevice {
  id: string;
  token: string;
  first_name: string | null;
  last_seen_at: string;
  session_expired_notified_at: string | null;
}

// session-expired push: one per lapse episode per device, re-armed on the user's return
async function handleCron(req: VercelRequest, res: VercelResponse) {
  const token = (req.headers['authorization'] ?? '').toString().replace(/^Bearer\s+/i, '');
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // QA shares the prod DB; this gate keeps the QA cron inert
  if (process.env.PUSH_CRON_ENABLED !== 'true' || !getFcm()) {
    return res.status(200).json({ skipped: true });
  }

  const now = new Date();
  const candidates = await pool.query<LapsedDevice>(
    `SELECT dt.id, dt.token,
            NULLIF(split_part(trim(COALESCE(p.name, '')), ' ', 1), '') AS first_name,
            dt.last_seen_at, dt.session_expired_notified_at
       FROM device_tokens dt
       LEFT JOIN profiles p ON p.anon_id = dt.anon_id
      WHERE dt.last_seen_at < now() - ($1 || ' milliseconds')::interval
        AND (dt.session_expired_notified_at IS NULL
             OR dt.session_expired_notified_at < dt.last_seen_at)`,
    [String(SESSION_EXPIRED_WINDOW_MS)],
  );

  const eligible = candidates.rows.filter((d) =>
    isSessionExpiredEligible(
      {
        lastSeenAt: new Date(d.last_seen_at),
        notifiedAt: d.session_expired_notified_at ? new Date(d.session_expired_notified_at) : null,
      },
      now,
      SESSION_EXPIRED_WINDOW_MS,
    ),
  );

  let sent = 0;
  for (const d of eligible) {
    // one bad token must not abort the batch
    try {
      const content = buildNotificationContent('session_expired', d.first_name);
      const r = await sendPush([d.token], content);
      await pruneDeadTokens(r.deadTokens);
      if (r.deadTokens.includes(d.token)) continue; // pruned → nothing to mark
      await pool.query(
        'UPDATE device_tokens SET session_expired_notified_at = now() WHERE id = $1',
        [d.id],
      );
      if (r.delivered) sent += 1;
    } catch (err) {
      console.error('[cron:session-expired] send failed', d.id, err);
    }
  }

  return res.status(200).json({ eligible: eligible.length, sent });
}
