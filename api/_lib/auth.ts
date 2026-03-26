import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from './better-auth.js';
import { handleCors } from './cors.js';
import pool from './db.js';

function toWebHeaders(nodeHeaders: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

export async function getUser(req: VercelRequest) {
  try {
    const session = await auth.api.getSession({
      headers: toWebHeaders(req.headers as Record<string, string | string[] | undefined>),
    });
    if (!session?.user) return null;
    return session.user;
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
  if ((user as Record<string, unknown>).status === 'disabled') {
    res.status(403).json({ error: 'Account disabled' });
    return null;
  }
  return user;
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if ((user as Record<string, unknown>).role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

// Set RLS session variable — call after requireUser(), before any queries
export async function setUserContext(userId: string) {
  await pool.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
}

// Returns true if OPTIONS preflight was handled
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  return handleCors(req, res);
}
