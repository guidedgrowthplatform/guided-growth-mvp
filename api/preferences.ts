import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';
import { requireUser } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const result = await pool.query('SELECT default_view FROM user_preferences WHERE user_id = $1', [user.id]);
    return res.json(result.rows[0] || { default_view: 'spreadsheet' });
  }

  if (req.method === 'PUT') {
    const { default_view } = req.body;
    await pool.query(
      `INSERT INTO user_preferences (user_id, default_view) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET default_view = $2`,
      [user.id, default_view]
    );
    return res.json({ default_view });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
