import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, handlePreflight } from '../_lib/auth.js';
import {
  calendarFetch,
  CalendarDisabledError,
  CalendarNotConnectedError,
  CalendarReauthRequiredError,
  getValidAccessToken,
  revokeToken,
} from '../_lib/calendar/google.js';
import pool from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  const user = await requireUser(req, res);
  if (!user) return;

  if (route === 'connect' && req.method === 'POST') return connect(req, res, user.anonId);
  if (route === 'status' && req.method === 'GET') return status(req, res, user.anonId);
  if (route === 'disconnect' && req.method === 'POST') return disconnect(req, res, user.anonId);
  if (route === 'target' && req.method === 'POST') return setTarget(req, res, user.anonId);
  if (route === 'toggle' && req.method === 'POST') return setEnabled(req, res, user.anonId);
  if (route === 'test' && req.method === 'POST') return testCall(req, res, user.anonId);

  return res.status(404).json({ error: 'Not found' });
}

// POST 'connect' — store the captured Google refresh token. Access token is minted
// on first use (getValidAccessToken), so the client only sends the refresh token.
async function connect(req: VercelRequest, res: VercelResponse, anonId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const refreshToken = body.refreshToken;
  const scopes = typeof body.scopes === 'string' ? body.scopes : null;

  if (typeof refreshToken !== 'string' || refreshToken.length < 10) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  await pool.query(
    `INSERT INTO calendar_connections (anon_id, refresh_token, scopes, enabled)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (anon_id) DO UPDATE
       SET refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
           scopes = EXCLUDED.scopes,
           access_token = NULL,
           token_expires_at = NULL,
           enabled = true,
           updated_at = now()`,
    [anonId, refreshToken, scopes],
  );
  return res.status(200).json({ ok: true });
}

async function status(_req: VercelRequest, res: VercelResponse, anonId: string) {
  const { rows } = await pool.query(
    `SELECT target, enabled FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
  );
  const row = rows[0];
  return res.status(200).json({
    connected: !!row,
    target: row?.target ?? 'gg',
    enabled: row?.enabled ?? false,
  });
}

async function disconnect(_req: VercelRequest, res: VercelResponse, anonId: string) {
  // Grab the token to revoke the grant at Google, then drop our copy.
  // CASCADE clears calendar_event_map. (Best-effort delete of GG events lands with A6.)
  const { rows } = await pool.query(
    `SELECT refresh_token FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
  );
  await pool.query(`DELETE FROM calendar_connections WHERE anon_id = $1`, [anonId]);
  const token = rows[0]?.refresh_token;
  if (token) void revokeToken(token);
  return res.status(200).json({ ok: true });
}

async function setTarget(req: VercelRequest, res: VercelResponse, anonId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const target = body.target;
  if (target !== 'own' && target !== 'gg') {
    return res.status(400).json({ error: "target must be 'own' or 'gg'" });
  }
  const { rowCount } = await pool.query(
    `UPDATE calendar_connections SET target = $2, updated_at = now() WHERE anon_id = $1`,
    [anonId, target],
  );
  if (!rowCount) return res.status(404).json({ error: 'not connected' });
  return res.status(200).json({ ok: true });
}

async function setEnabled(req: VercelRequest, res: VercelResponse, anonId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const enabled = body.enabled;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  const { rowCount } = await pool.query(
    `UPDATE calendar_connections SET enabled = $2, updated_at = now() WHERE anon_id = $1`,
    [anonId, enabled],
  );
  if (!rowCount) return res.status(404).json({ error: 'not connected' });
  return res.status(200).json({ ok: true });
}

// POST 'test' — secret-gated dev route: prove refresh + Bearer + scope end to end.
async function testCall(req: VercelRequest, res: VercelResponse, anonId: string) {
  if (!verifyDevSecret(req)) return res.status(403).json({ error: 'forbidden' });
  try {
    const token = await getValidAccessToken(anonId);
    const list = await calendarFetch<{ items?: unknown[] }>(token, '/users/me/calendarList');
    return res.status(200).json({ ok: true, calendarCount: list.items?.length ?? 0 });
  } catch (err) {
    if (err instanceof CalendarNotConnectedError) {
      return res.status(409).json({ error: 'not_connected' });
    }
    if (err instanceof CalendarDisabledError) {
      return res.status(409).json({ error: 'disabled' });
    }
    if (err instanceof CalendarReauthRequiredError) {
      return res.status(401).json({ error: 'reauth_required' });
    }
    console.error('[calendar] test call failed', err);
    return res.status(502).json({ error: 'google_error' });
  }
}

function verifyDevSecret(req: VercelRequest): boolean {
  const expected = process.env.QA_RESET_TOKEN;
  if (!expected) return false;
  const provided = req.headers['x-qa-token'];
  if (typeof provided !== 'string' || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
