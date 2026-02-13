import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db';
import { requireAdmin } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const result = await pool.query('SELECT id, email, name, avatar_url, role, status, created_at, last_login_at FROM users ORDER BY created_at DESC');
    return res.json(result.rows);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
