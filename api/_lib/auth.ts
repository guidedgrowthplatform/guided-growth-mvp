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

type VerifiedClaims = {
  authUserId: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
};

async function verifyToken(
  req: VercelRequest,
): Promise<VerifiedClaims | { authError: AuthErrorCode }> {
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

  const claims = user.app_metadata as { role?: string; status?: string };
  return {
    authUserId: user.id,
    // anonymous (guest) users have no email
    email: user.email ?? '',
    role: (claims.role ?? 'user') as 'user' | 'admin',
    status: (claims.status ?? 'active') as 'active' | 'disabled',
  };
}

export async function getUserOrError(req: VercelRequest): Promise<AuthResult> {
  const verified = await verifyToken(req);
  if ('authError' in verified) return verified;

  let profile;
  try {
    const profileRes = await pool.query<{ anon_id: string; first_name: string | null }>(
      `SELECT anon_id,
              NULLIF(split_part(trim(COALESCE(name, '')), ' ', 1), '') AS first_name
         FROM profiles
        WHERE id = $1`,
      [verified.authUserId],
    );
    profile = profileRes.rows[0];
  } catch (e) {
    // DB/infra blip — don't log the user out
    console.warn('[auth] profiles query failed', e);
    return { authError: 'auth_unavailable' };
  }
  if (!profile) {
    console.warn('[auth] profile row missing for authenticated user', verified.authUserId);
    return { authError: 'invalid_token' };
  }

  return {
    authUserId: verified.authUserId,
    anonId: profile.anon_id,
    firstName: profile.first_name,
    email: verified.email,
    role: verified.role,
    status: verified.status,
  };
}

function sendAuthError(res: VercelResponse, code: AuthErrorCode): null {
  const body: AuthErrorBody =
    code === 'auth_unavailable'
      ? { error: 'Authentication temporarily unavailable', code }
      : { error: 'Authentication required', code };
  res.status(code === 'auth_unavailable' ? 503 : 401).json(body);
  return null;
}

export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const result = await getUserOrError(req);
  if ('authError' in result) return sendAuthError(res, result.authError);
  if (result.status === 'disabled') {
    res.status(403).json({ error: 'Account disabled' });
    return null;
  }
  return result;
}

// JWT-only, no profiles query — keeps the cold pg connect (~2.8s) off the
// token-mint latency path.
export async function requireUserNoDb(
  req: VercelRequest,
  res: VercelResponse,
): Promise<{ authUserId: string; status: 'active' | 'disabled' } | null> {
  const verified = await verifyToken(req);
  if ('authError' in verified) return sendAuthError(res, verified.authError);
  if (verified.status === 'disabled') {
    res.status(403).json({ error: 'Account disabled' });
    return null;
  }
  return { authUserId: verified.authUserId, status: verified.status };
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
