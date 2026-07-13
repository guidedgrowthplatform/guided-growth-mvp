import { randomBytes } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { CALENDAR_SCOPES } from '@gg/shared/constants';
import pool from '../db.js';
import { clearEventCaches } from './events.js';
import { revokeToken } from './google.js';

// Own consent + code exchange so a calendar grant never re-auths the Supabase
// session. `state` = opaque single-use nonce, bound server-side.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
// Single-segment path: Vercel only routes 1-segment sub-paths to functions.
const CALLBACK_PATH = '/api/calendar/oauth-callback';
const NONCE_TTL = "interval '10 minutes'";
const PROD_ORIGIN_FALLBACK = 'https://guided-growth-mvp.vercel.app';

export type OAuthPlatform = 'web' | 'native';
export const NATIVE_SCHEMES = ['guidedgrowth', 'guidedgrowthqa'] as const;
export type NativeScheme = (typeof NATIVE_SCHEMES)[number];

export interface OAuthStateRow {
  anonId: string;
  platform: OAuthPlatform;
  scheme: string | null;
}

// Pre-registered in Google console (no wildcards) → NOT VERCEL_URL (per-deploy).
export function calendarRedirectOrigin(): string {
  const origin = process.env.CALENDAR_OAUTH_REDIRECT_ORIGIN;
  if (origin) return origin.replace(/\/$/, '');
  console.warn('[calendar/oauth] CALENDAR_OAUTH_REDIRECT_ORIGIN unset — using prod fallback');
  return PROD_ORIGIN_FALLBACK;
}

export function calendarRedirectUri(): string {
  return `${calendarRedirectOrigin()}${CALLBACK_PATH}`;
}

export async function createOAuthNonce(
  anonId: string,
  platform: OAuthPlatform,
  scheme: string | null,
): Promise<string> {
  const nonce = randomBytes(32).toString('hex');
  await pool.query(`DELETE FROM calendar_oauth_state WHERE created_at < now() - interval '1 hour'`);
  await pool.query(
    `INSERT INTO calendar_oauth_state (nonce, anon_id, platform, scheme) VALUES ($1, $2, $3, $4)`,
    [nonce, anonId, platform, scheme],
  );
  return nonce;
}

// Atomic single-use consume: null = missing / expired / already used.
export async function consumeOAuthNonce(nonce: string): Promise<OAuthStateRow | null> {
  if (!nonce) return null;
  const { rows } = await pool.query(
    `DELETE FROM calendar_oauth_state
      WHERE nonce = $1 AND created_at > now() - ${NONCE_TTL}
      RETURNING anon_id, platform, scheme`,
    [nonce],
  );
  const row = rows[0] as
    | { anon_id: string; platform: OAuthPlatform; scheme: string | null }
    | undefined;
  if (!row) return null;
  return { anonId: row.anon_id, platform: row.platform, scheme: row.scheme };
}

// offline + prompt=consent → a refresh token on every grant.
export function buildConsentUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: calendarRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// The consent screen lets a user uncheck a scope — verify both landed.
export function hasRequiredScopes(granted: string | undefined): boolean {
  const set = new Set((granted ?? '').split(/\s+/).filter(Boolean));
  return CALENDAR_SCOPES.split(/\s+/).every((s) => set.has(s));
}

export function isValidScheme(scheme: unknown): scheme is NativeScheme {
  return typeof scheme === 'string' && (NATIVE_SCHEMES as readonly string[]).includes(scheme);
}

// Store a fresh grant; revoke the superseded token on reconnect (best-effort).
export async function persistCalendarGrant(
  anonId: string,
  refreshToken: string,
  scope: string | null,
): Promise<void> {
  const existing = await pool.query(
    `SELECT refresh_token FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
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
    [anonId, refreshToken, scope],
  );
  clearEventCaches(anonId);
}

// Where the callback 302s back to: web → Settings; native → deep link under the
// already-registered `auth` host. No-nonce (row null) falls back to web.
export function oauthReturnUrl(row: OAuthStateRow | null, ok: boolean): string {
  const status = ok ? 'connected' : 'error';
  return row?.platform === 'native' && isValidScheme(row.scheme)
    ? `${row.scheme}://auth/calendar-connected?calendar=${status}`
    : `${calendarRedirectOrigin()}/settings?calendar=${status}`;
}
