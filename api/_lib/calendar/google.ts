import pool from '../db.js';

// Server-side Google Calendar access: token refresh + a Bearer fetch wrapper.
// Refresh token lives in the service-role-only calendar_connections table.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
const EXPIRY_SKEW_MS = 60_000;

// Thrown when the user has no calendar connection (row / refresh token missing).
export class CalendarNotConnectedError extends Error {
  constructor() {
    super('calendar_not_connected');
    this.name = 'CalendarNotConnectedError';
  }
}

// Thrown when connected but the master switch is off (row exists, enabled=false).
export class CalendarDisabledError extends Error {
  constructor() {
    super('calendar_disabled');
    this.name = 'CalendarDisabledError';
  }
}

// Thrown when Google rejects the refresh token (invalid_grant) — the user must reconnect.
export class CalendarReauthRequiredError extends Error {
  constructor() {
    super('calendar_reauth_required');
    this.name = 'CalendarReauthRequiredError';
  }
}

// Non-2xx from the Calendar API — carries status so callers can branch (404/410 = gone).
export class CalendarApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`google calendar API ${path} failed: ${status}`);
    this.name = 'CalendarApiError';
    this.status = status;
  }
}

interface RefreshResult {
  access_token: string;
  expires_in: number;
  refresh_token?: string; // Google may rotate the refresh token on a refresh grant.
}

interface CodeExchangeResult {
  access_token: string;
  expires_in: number;
  refresh_token?: string; // present only with access_type=offline + first/prompt=consent
  scope?: string; // space-delimited scopes the user actually granted
}

// redirectUri MUST byte-match the one sent to the consent screen.
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<CodeExchangeResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error('[calendar/google] code exchange failed', {
      status: response.status,
      body: errBody.slice(0, 500),
    });
    throw new Error(`google code exchange failed: ${response.status}`);
  }

  const json = (await response.json()) as CodeExchangeResult;
  if (typeof json.access_token !== 'string' || !Number.isFinite(json.expires_in)) {
    throw new Error('google code exchange: malformed response');
  }
  return json;
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    // invalid_grant = revoked / expired refresh token → reconnect needed.
    if (response.status === 400) {
      let code = '';
      try {
        code = (JSON.parse(errBody) as { error?: string }).error ?? '';
      } catch {
        /* non-JSON body */
      }
      if (code === 'invalid_grant') throw new CalendarReauthRequiredError();
    }
    console.error('[calendar/google] token refresh failed', {
      status: response.status,
      body: errBody.slice(0, 500),
    });
    throw new Error(`google token refresh failed: ${response.status}`);
  }

  const json = (await response.json()) as RefreshResult;
  if (typeof json.access_token !== 'string' || !Number.isFinite(json.expires_in)) {
    throw new Error('google token refresh: malformed response');
  }
  return json;
}

// Best-effort revocation of the OAuth grant at Google (fire-and-forget on disconnect).
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.warn('[calendar/google] token revoke failed (best-effort)', e);
  }
}

// Read the stored connection, refresh the access token if stale, persist, return it.
export async function getValidAccessToken(anonId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT access_token, refresh_token, token_expires_at, enabled
       FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
  );
  const row = rows[0];
  if (!row || !row.refresh_token) {
    throw new CalendarNotConnectedError();
  }
  if (row.enabled === false) {
    throw new CalendarDisabledError();
  }

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return row.access_token;
  }

  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
  // Persist a rotated refresh token if Google returned one; else keep the current.
  await pool.query(
    `UPDATE calendar_connections
        SET access_token = $2, token_expires_at = $3,
            refresh_token = COALESCE($4, refresh_token), updated_at = now()
      WHERE anon_id = $1`,
    [anonId, refreshed.access_token, newExpiry.toISOString(), refreshed.refresh_token ?? null],
  );
  return refreshed.access_token;
}

// Bearer fetch against the Calendar API. `path` is relative to /calendar/v3.
export async function calendarFetch<T = unknown>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error('[calendar/google] calendar API error', {
      status: response.status,
      path,
      body: errBody.slice(0, 500),
    });
    throw new CalendarApiError(response.status, path);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
