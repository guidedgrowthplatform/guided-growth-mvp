import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireUser(req, res);
  if (!user) return;

  const { metric_ids } = req.body;
  if (!Array.isArray(metric_ids)) return res.status(400).json({ error: 'metric_ids array required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < metric_ids.length; i++) {
      await client.query('UPDATE metrics SET sort_order = $1 WHERE id = $2 AND user_id = $3', [i, metric_ids[i], user.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const result = await pool.query('SELECT * FROM metrics WHERE user_id = $1 ORDER BY sort_order ASC', [user.id]);
  res.json(result.rows);
}
