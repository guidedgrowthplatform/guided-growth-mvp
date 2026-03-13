import * as jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './db.js';

const SECRET = () => process.env.SESSION_SECRET || 'dev-secret';

export function signToken(userId: string): string {
  return jwt.sign({ userId }, SECRET(), { expiresIn: '7d' });
}

export function setAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `token=${token}; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=604800`;
}

export function clearAuthCookie(): string {
  return 'token=; HttpOnly; Path=/; Max-Age=0';
}

export async function getUser(req: VercelRequest) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;

  const match = cookie.match(/token=([^;]+)/);
  if (!match) return null;

  try {
    const payload = jwt.verify(match[1], SECRET()) as { userId: string };
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    return result.rows[0] || null;
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
