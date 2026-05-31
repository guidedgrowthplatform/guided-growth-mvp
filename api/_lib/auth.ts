import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from '@shared/types';
import { handleCors } from './cors.js';
import pool from './db.js';
import { supabaseAdmin } from './supabase-admin.js';

export type { AuthenticatedUser };

export async function getUser(req: VercelRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }

    const profileRes = await pool.query<{ anon_id: string; first_name: string | null }>(
      `SELECT anon_id,
              NULLIF(split_part(trim(COALESCE(name, '')), ' ', 1), '') AS first_name
         FROM profiles
        WHERE id = $1`,
      [user.id],
    );
    const profile = profileRes.rows[0];
    if (!profile) {
      console.warn('[auth] profile row missing for authenticated user', user.id);
      return null;
    }

    const claims = user.app_metadata as { role?: string; status?: string };
    return {
      authUserId: user.id,
      anonId: profile.anon_id,
      firstName: profile.first_name,
      email: user.email!,
      role: (claims.role ?? 'user') as 'user' | 'admin',
      status: (claims.status ?? 'active') as 'active' | 'disabled',
    };
  } catch {
    return null;
  }
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
