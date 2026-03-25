import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';
import { requireUser, handlePreflight } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const result = await pool.query('SELECT value FROM affirmations WHERE user_id = $1', [user.id]);
    return res.json({ value: result.rows[0]?.value || '' });
  }

  if (req.method === 'PUT') {
    const { value } = req.body;
    await pool.query(
      `INSERT INTO affirmations (user_id, value) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET value = $2`,
      [user.id, value],
    );
    return res.json({ value });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
