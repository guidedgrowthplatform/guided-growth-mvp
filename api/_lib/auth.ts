import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from '@shared/types';
import { handleCors } from './cors.js';
import pool from './db.js';
import { supabaseAdmin } from './supabase-admin.js';

export type { AuthenticatedUser };

type ProfileClaims = {
  anonId: string;
  firstName: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
};

// Pure JWT reader. Null if anon_id missing (legacy pre-026 token).
export function readClaimsFromJwt(meta: Record<string, unknown>): ProfileClaims | null {
  const anonId = typeof meta.anon_id === 'string' ? meta.anon_id : null;
  if (!anonId) return null;
  const firstName = typeof meta.first_name === 'string' ? meta.first_name : null;
  return {
    anonId,
    firstName,
    role: meta.role === 'admin' ? 'admin' : 'user',
    status: meta.status === 'disabled' ? 'disabled' : 'active',
  };
}

// DB fallback for legacy tokens. role/status still from JWT.
async function fetchClaimsFromDb(
  authUserId: string,
  meta: Record<string, unknown>,
): Promise<ProfileClaims | null> {
  const profileRes = await pool.query<{ anon_id: string; first_name: string | null }>(
    `SELECT anon_id,
            NULLIF(split_part(trim(COALESCE(name, '')), ' ', 1), '') AS first_name
       FROM profiles
      WHERE id = $1`,
    [authUserId],
  );
  const row = profileRes.rows[0];
  if (!row) return null;
  return {
    anonId: row.anon_id,
    firstName: row.first_name,
    role: meta.role === 'admin' ? 'admin' : 'user',
    status: meta.status === 'disabled' ? 'disabled' : 'active',
  };
}

export async function getUser(req: VercelRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const claims = readClaimsFromJwt(meta) ?? (await fetchClaimsFromDb(user.id, meta));

    if (!claims) {
      console.warn('[auth] profile row missing for authenticated user', user.id);
      return null;
    }

    if (!('anon_id' in meta)) {
      // info, not warn — avoids Sentry spam during ~1h legacy token window.
      console.info('[auth] legacy token, fell back to profiles SELECT', user.id);
    }

    return {
      authUserId: user.id,
      anonId: claims.anonId,
      firstName: claims.firstName,
      email: user.email!,
      role: claims.role,
      status: claims.status,
    };
  } catch {
    return null;
  }
}

export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (user.status === 'disabled') {
    res.status(403).json({ error: 'Account disabled' });
    return null;
  }
  return user;
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
