import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db';
import { requireUser } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of ['name', 'input_type', 'question', 'active', 'frequency']) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id, user.id);
    const result = await pool.query(
      `UPDATE metrics SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json(result.rows[0]);
  }

  if (req.method === 'DELETE') {
    const result = await pool.query('DELETE FROM metrics WHERE id = $1 AND user_id = $2', [id, user.id]);
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ message: 'Deleted' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
