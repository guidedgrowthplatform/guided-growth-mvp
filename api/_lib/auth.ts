import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from './better-auth.js';
import { setCorsHeaders } from './cors.js';
import { fromNodeHeaders } from 'better-auth/node';
import pool from './db.js';

export async function getUser(req: VercelRequest) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) return null;

    // Look up role and status from users table (falls back to defaults)
    const result = await pool.query('SELECT role, status FROM users WHERE id = $1', [
      session.user.id,
    ]);
    const dbUser = result.rows[0];

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      role: dbUser?.role ?? 'user',
      status: dbUser?.status ?? 'active',
    };
  } catch {
    return null;
  }
}

/**
 * Require authenticated user. Sets CORS headers for Capacitor origins.
 * Returns null (and sends 401) if unauthenticated.
 */
export async function requireUser(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers so Capacitor WebView receives proper responses
  setCorsHeaders(req, res);

  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
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

/**
 * Handle OPTIONS preflight for Capacitor cross-origin requests.
 * Call at the start of any handler that doesn't use requireUser.
 * Returns true if the request was an OPTIONS preflight (already handled).
 */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  const corsOk = setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(corsOk ? 204 : 403).end();
    return true;
  }
  return false;
}
