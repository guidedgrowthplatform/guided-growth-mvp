import { timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, handlePreflight } from '../_lib/auth.js';
import {
  calendarFetch,
  CalendarDisabledError,
  CalendarNotConnectedError,
  CalendarReauthRequiredError,
  exchangeCodeForTokens,
  getValidAccessToken,
  refreshAccessToken,
  revokeToken,
} from '../_lib/calendar/google.js';
import { clearEventCaches, deleteEvent } from '../_lib/calendar/events.js';
import {
  buildConsentUrl,
  calendarRedirectOrigin,
  calendarRedirectUri,
  consumeOAuthNonce,
  createOAuthNonce,
  hasRequiredScopes,
  isValidScheme,
  type OAuthPlatform,
  type OAuthStateRow,
} from '../_lib/calendar/oauth.js';
import { runSync } from '../_lib/calendar/writer.js';
import pool from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // PUBLIC: Google's redirect has no auth header — handle before requireUser.
  if (segments[0] === 'oauth' && segments[1] === 'callback') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    return oauthCallback(req, res);
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (route === 'status' && req.method === 'GET') return status(req, res, user.anonId);
  if (route === 'disconnect' && req.method === 'POST') return disconnect(req, res, user.anonId);
  if (route === 'target' && req.method === 'POST') return setTarget(req, res, user.anonId);
  if (route === 'toggle' && req.method === 'POST') return setEnabled(req, res, user.anonId);
  if (route === 'sync' && req.method === 'POST') return sync(req, res, user.anonId);
  if (route === 'test' && req.method === 'POST') return testCall(req, res, user.anonId);
  if (segments[0] === 'oauth' && segments[1] === 'start' && req.method === 'POST') {
    return oauthStart(req, res, user.anonId);
  }

  return res.status(404).json({ error: 'Not found' });
}

// Decoupled from login: token returns to our own callback, so the session /
// anon_id are never touched.
async function oauthStart(req: VercelRequest, res: VercelResponse, anonId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const platform = body.platform;
  if (platform !== 'web' && platform !== 'native') {
    return res.status(400).json({ error: "platform must be 'web' or 'native'" });
  }
  let scheme: string | null = null;
  if (platform === 'native') {
    if (!isValidScheme(body.scheme)) return res.status(400).json({ error: 'invalid scheme' });
    scheme = body.scheme;
  }
  const nonce = await createOAuthNonce(anonId, platform as OAuthPlatform, scheme);
  return res.status(200).json({ url: buildConsentUrl(nonce) });
}

async function oauthCallback(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string | string[] | undefined>;
  const state = typeof q.state === 'string' ? q.state : '';
  const code = typeof q.code === 'string' ? q.code : '';
  const googleError = typeof q.error === 'string' ? q.error : '';

  const row = await consumeOAuthNonce(state);
  if (!row) return redirectResult(res, null, false);
  if (googleError || !code) return redirectResult(res, row, false);

  try {
    const tokens = await exchangeCodeForTokens(code, calendarRedirectUri());
    const refreshToken = tokens.refresh_token;
    if (typeof refreshToken !== 'string' || refreshToken.length < 10) {
      console.warn('[calendar] oauth callback: no refresh token in exchange');
      return redirectResult(res, row, false);
    }
    if (!hasRequiredScopes(tokens.scope)) {
      console.warn('[calendar] oauth callback: missing required scopes', tokens.scope);
      return redirectResult(res, row, false);
    }

    // Reconnect: revoke the superseded grant (best-effort).
    const existing = await pool.query(
      `SELECT refresh_token FROM calendar_connections WHERE anon_id = $1`,
      [row.anonId],
    );
    const oldToken = existing.rows[0]?.refresh_token as string | undefined;
    if (oldToken && oldToken !== refreshToken) waitUntil(revokeToken(oldToken));

    await pool.query(
      `INSERT INTO calendar_connections (anon_id, refresh_token, scopes, enabled)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (anon_id) DO UPDATE
         SET refresh_token = EXCLUDED.refresh_token,
             scopes = EXCLUDED.scopes,
             access_token = NULL,
             token_expires_at = NULL,
             enabled = true,
             updated_at = now()`,
      [row.anonId, refreshToken, tokens.scope ?? null],
    );
    clearEventCaches(row.anonId);
    return redirectResult(res, row, true);
  } catch (err) {
    console.error('[calendar] oauth callback exchange failed', err);
    return redirectResult(res, row, false);
  }
}

function redirectResult(res: VercelResponse, row: OAuthStateRow | null, ok: boolean) {
  const status = ok ? 'connected' : 'error';
  const url =
    row?.platform === 'native' && isValidScheme(row.scheme)
      ? `${row.scheme}://auth/calendar-connected?calendar=${status}`
      : `${calendarRedirectOrigin()}/settings?calendar=${status}`;
  res.setHeader('Location', url);
  return res.status(302).end();
}

async function status(_req: VercelRequest, res: VercelResponse, anonId: string) {
  const { rows } = await pool.query(
    `SELECT target, enabled FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
  );
  const row = rows[0];
  if (!row) {
    return res
      .status(200)
      .json({ connected: false, target: 'gg', enabled: false, needsReauth: false });
  }
  // Paused: token health is irrelevant, and probing a disabled row would throw.
  if (row.enabled === false) {
    return res
      .status(200)
      .json({ connected: true, target: row.target ?? 'gg', enabled: false, needsReauth: false });
  }
  // Probe the token — usually free (cached access token, no Google call).
  let needsReauth = false;
  try {
    await getValidAccessToken(anonId);
  } catch (err) {
    if (err instanceof CalendarReauthRequiredError) needsReauth = true;
    else if (err instanceof CalendarNotConnectedError) {
      return res
        .status(200)
        .json({ connected: false, target: 'gg', enabled: false, needsReauth: false });
    }
    // Google 5xx / network → no false alarm.
  }
  return res
    .status(200)
    .json({ connected: true, target: row.target ?? 'gg', enabled: true, needsReauth });
}

async function disconnect(_req: VercelRequest, res: VercelResponse, anonId: string) {
  const { rows } = await pool.query(
    `SELECT refresh_token FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
  );
  const token = rows[0]?.refresh_token as string | undefined;

  // Best-effort delete of the events we created. Refresh directly (not
  // getValidAccessToken) so cleanup still runs when disabled.
  if (token) {
    try {
      const map = await pool.query(
        `SELECT calendar_id, google_event_id FROM calendar_event_map WHERE anon_id = $1`,
        [anonId],
      );
      if (map.rows.length > 0) {
        const { access_token } = await refreshAccessToken(token);
        await Promise.allSettled(
          (map.rows as { calendar_id: string; google_event_id: string }[]).map((r) =>
            deleteEvent(access_token, r.calendar_id, r.google_event_id),
          ),
        );
      }
    } catch (err) {
      console.warn('[calendar] disconnect event cleanup failed (best-effort)', err);
    }
  }

  // Both tables key off profiles(anon_id), so no FK cascade between them — drop each.
  await pool.query(`DELETE FROM calendar_event_map WHERE anon_id = $1`, [anonId]);
  await pool.query(`DELETE FROM calendar_connections WHERE anon_id = $1`, [anonId]);
  clearEventCaches(anonId);
  if (token) waitUntil(revokeToken(token));
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
  // Re-materialize on re-enable via the client's syncCalendar() (fired in useCalendar's
  // onSuccess) — not a server-side fire-and-forget, which a serverless freeze can truncate.
  return res.status(200).json({ ok: true });
}

// POST 'sync' — write the user's rituals to their calendar (idempotent).
async function sync(_req: VercelRequest, res: VercelResponse, anonId: string) {
  try {
    const result = await runSync(anonId);
    return res.status(200).json({ ok: true, ...result });
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
    console.error('[calendar] sync failed', err);
    return res.status(502).json({ error: 'google_error' });
  }
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
