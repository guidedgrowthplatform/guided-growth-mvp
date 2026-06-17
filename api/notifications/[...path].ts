import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { NotificationRecord } from '@gg/shared/types';
import pool from '../_lib/db.js';
import { requireUser, handlePreflight } from '../_lib/auth.js';
import { validateUUID } from '../_lib/validation.js';
import { sendPush, pruneDeadTokens, getFcm } from '../_lib/firebase.js';
import { computeDue, type SchedulePrefs } from '../_lib/notification-schedule.js';
import { buildNotificationContent } from '../_lib/notification-templates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

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

// ─── Cron: Tier 1 morning/evening reminders ─────────

interface UnsentRow {
  id: string;
  anon_id: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
}

function secretMatches(token: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleCron(req: VercelRequest, res: VercelResponse) {
  const token = (req.headers['authorization'] ?? '').toString().replace(/^Bearer\s+/i, '');
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // QA project deploys the same vercel.json crons against the prod DB; without
  // this gate it could win the idempotent insert and never deliver.
  if (process.env.PUSH_CRON_ENABLED !== 'true' || !getFcm()) {
    return res.status(200).json({ skipped: true });
  }

  const prefsResult = await pool.query<SchedulePrefs>(
    `SELECT up.anon_id,
            NULLIF(split_part(trim(COALESCE(p.name, '')), ' ', 1), '') AS first_name,
            up.timezone,
            up.morning_time::text AS morning_time,
            up.night_time::text   AS night_time
       FROM user_preferences up
       JOIN profiles p ON p.anon_id = up.anon_id
      WHERE up.push_notifications = true
        AND up.timezone IS NOT NULL
        AND EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.anon_id = up.anon_id)`,
  );

  const due = computeDue(prefsResult.rows, new Date());

  let inserted = 0;
  for (const d of due) {
    const content = buildNotificationContent(d.type, d.first_name);
    const result = await pool.query(
      `INSERT INTO notifications (anon_id, type, category, title, body, data, local_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (anon_id, type, local_date) DO NOTHING`,
      [
        d.anon_id,
        d.type,
        content.category,
        content.title,
        content.body,
        content.data,
        d.local_date,
      ],
    );
    inserted += result.rowCount ?? 0;
  }

  // single send path doubles as the retry sweep for transient FCM failures
  const unsent = await pool.query<UnsentRow>(
    `SELECT id, anon_id, title, body, data
       FROM notifications
      WHERE sent_at IS NULL
        AND created_at > now() - interval '1 hour'`,
  );

  const anonIds = [...new Set(unsent.rows.map((r) => r.anon_id))];
  const tokensByAnon = new Map<string, string[]>();
  if (anonIds.length > 0) {
    const tokenRows = await pool.query<{ anon_id: string; token: string }>(
      'SELECT anon_id, token FROM device_tokens WHERE anon_id = ANY($1)',
      [anonIds],
    );
    for (const r of tokenRows.rows) {
      tokensByAnon.set(r.anon_id, [...(tokensByAnon.get(r.anon_id) ?? []), r.token]);
    }
  }

  let sent = 0;
  for (const row of unsent.rows) {
    const tokens = tokensByAnon.get(row.anon_id) ?? [];
    if (tokens.length === 0) continue;

    try {
      const result = await sendPush(tokens, {
        title: row.title,
        body: row.body,
        data: row.data ?? {},
      });
      await pruneDeadTokens(result.deadTokens);
      if (result.delivered) {
        await pool.query('UPDATE notifications SET sent_at = now() WHERE id = $1', [row.id]);
        sent += 1;
      }
    } catch (err) {
      // transient FCM failure — row stays unsent, next run retries
      console.error('[notifications/cron] send failed', row.id, err);
    }
  }

  return res.status(200).json({ due: due.length, inserted, sent });
}
