import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT * FROM metrics WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [user.id]
    );
    return res.json(result.rows);
  }

  if (req.method === 'POST') {
    const { name, input_type, question, frequency, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const orderRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM metrics WHERE user_id = $1',
      [user.id]
    );
    const result = await pool.query(
      `INSERT INTO metrics (user_id, name, input_type, question, active, frequency, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.id, name, input_type || 'binary', question || '', active ?? true, frequency || 'daily', orderRes.rows[0].next]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
