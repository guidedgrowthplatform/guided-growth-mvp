import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthenticatedUser, AuthErrorCode, AuthErrorBody } from '@gg/shared/types';
import { decodeJwtPayload } from '@gg/shared/utils/jwt';
import { handleCors } from './cors.js';
import pool from './db.js';
import { supabaseAdmin } from './supabase-admin.js';

export type { AuthenticatedUser };

type AuthResult = AuthenticatedUser | { authError: AuthErrorCode };

// expired vs malformed, off the token's own exp claim
function classifyTokenError(token: string): 'token_expired' | 'invalid_token' {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (exp !== null && exp * 1000 < Date.now()) return 'token_expired';
  return 'invalid_token';
}

export async function getUserOrError(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authError: 'no_token' };
  }

  const token = authHeader.slice(7);

  let user;
  try {
    const res = await supabaseAdmin.auth.getUser(token);
    if (res.error) {
      const err = res.error as { name?: string; status?: number };
      // network/retryable or no http status -> outage, not a bad token
      if (err.name === 'AuthRetryableFetchError' || typeof err.status !== 'number') {
        return { authError: 'auth_unavailable' };
      }
      return { authError: classifyTokenError(token) };
    }
    user = res.data.user;
  } catch {
    return { authError: 'auth_unavailable' };
  }
  if (!user) return { authError: classifyTokenError(token) };

  let profile;
  try {
    const profileRes = await pool.query<{ anon_id: string; first_name: string | null }>(
      `SELECT anon_id,
              NULLIF(split_part(trim(COALESCE(name, '')), ' ', 1), '') AS first_name
         FROM profiles
        WHERE id = $1`,
      [user.id],
    );
    profile = profileRes.rows[0];
  } catch (e) {
    // DB/infra blip — don't log the user out
    console.warn('[auth] profiles query failed', e);
    return { authError: 'auth_unavailable' };
  }
  if (!profile) {
    console.warn('[auth] profile row missing for authenticated user', user.id);
    return { authError: 'invalid_token' };
  }

  const claims = user.app_metadata as { role?: string; status?: string };
  return {
    authUserId: user.id,
    anonId: profile.anon_id,
    firstName: profile.first_name,
    // anonymous (guest) users have no email
    email: user.email ?? '',
    role: (claims.role ?? 'user') as 'user' | 'admin',
    status: (claims.status ?? 'active') as 'active' | 'disabled',
  };
}

// JWT-only verify, no profiles query — keeps the cold pg connect (~2.8s) off
// latency-critical paths that need just the auth user id (e.g. STT temp key).
export async function getAuthUserNoDb(
  req: VercelRequest,
): Promise<{ authUserId: string; status: 'active' | 'disabled' } | null> {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    const claims = user.app_metadata as { status?: string };
    return { authUserId: user.id, status: (claims.status ?? 'active') as 'active' | 'disabled' };
  } catch {
    // network/infra blip — not a token verdict
    return null;
  }
}

export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const result = await getUserOrError(req);
  if ('authError' in result) {
    const code = result.authError;
    const body: AuthErrorBody =
      code === 'auth_unavailable'
        ? { error: 'Authentication temporarily unavailable', code }
        : { error: 'Authentication required', code };
    res.status(code === 'auth_unavailable' ? 503 : 401).json(body);
    return null;
  }
  if (result.status === 'disabled') {
    res.status(403).json({ error: 'Account disabled' });
    return null;
  }
  return result;
}

export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

export async function setUserContext(_userId: string) {
  // No-op
}

export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  return handleCors(req, res);
}
