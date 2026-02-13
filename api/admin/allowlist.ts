import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const result = await pool.query(
      `SELECT a.*, u.email as added_by_email FROM allowlist a LEFT JOIN users u ON a.added_by_user_id = u.id ORDER BY a.created_at DESC`
    );
    return res.json(result.rows);
  }

  if (req.method === 'POST') {
    const { email, note } = req.body;
    if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    const exists = await pool.query('SELECT id FROM allowlist WHERE email = $1', [email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Already in allowlist' });
    const result = await pool.query(
      'INSERT INTO allowlist (email, added_by_user_id, note) VALUES ($1, $2, $3) RETURNING *',
      [email, user.id, note || null]
    );
    return res.status(201).json(result.rows[0]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const result = await pool.query('DELETE FROM allowlist WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ message: 'Removed' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
