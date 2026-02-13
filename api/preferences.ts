import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';
import { requireUser } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT default_view, spreadsheet_range FROM user_preferences WHERE user_id = $1',
      [user.id]
    );
    return res.json(result.rows[0] || { default_view: 'spreadsheet', spreadsheet_range: 'month' });
  }

  if (req.method === 'PUT') {
    const { default_view, spreadsheet_range } = req.body;
    const view = default_view || 'spreadsheet';
    const range = spreadsheet_range || 'month';
    await pool.query(
      `INSERT INTO user_preferences (user_id, default_view, spreadsheet_range) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET default_view = $2, spreadsheet_range = $3`,
      [user.id, view, range]
    );
    return res.json({ default_view: view, spreadsheet_range: range });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
