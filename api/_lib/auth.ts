import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './better-auth.js';
import pool from './db.js';

export async function getUser(req: VercelRequest) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) return null;

    // Look up full user from our users table (for role, status, etc.)
    const result = await pool.query('SELECT * FROM users WHERE id = $1 OR email = $2', [
      session.user.id,
      session.user.email,
    ]);

    if (result.rows[0]) {
      return result.rows[0];
    }

    // User exists in Better Auth but not in our users table yet
    // Auto-create user record for Better Auth users
    const now = new Date();
    const email = session.user.email;
    const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
    const insertResult = await pool.query(
      `INSERT INTO users (id, email, name, avatar_url, role, last_login_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $6)
       ON CONFLICT (email) DO UPDATE SET last_login_at = $6, updated_at = $6
       RETURNING *`,
      [session.user.id, email, session.user.name, session.user.image, role, now],
    );
    return insertResult.rows[0] || null;
  } catch {
    return null;
  }
}

export async function requireUser(req: VercelRequest, res: VercelResponse) {
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

export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

// Legacy exports kept for backward compatibility (no longer used)
export function signToken(_userId: string): string {
  throw new Error('signToken is deprecated — use Better Auth sessions');
}

export function setAuthCookie(_token: string): string {
  throw new Error('setAuthCookie is deprecated — Better Auth manages cookies');
}

export function clearAuthCookie(): string {
  throw new Error('clearAuthCookie is deprecated — use Better Auth signOut');
}
