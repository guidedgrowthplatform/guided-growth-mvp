import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : (segments[0] || '');

  // PUT /api/metrics/reorder
  if (route === 'reorder') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
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
    return res.json(result.rows);
  }

  // /api/metrics/:id — PATCH or DELETE
  if (route && route !== 'reorder') {
    const id = route;
    if (req.method === 'PATCH') {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      for (const key of ['name', 'input_type', 'question', 'active', 'frequency', 'target_value', 'target_unit']) {
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // /api/metrics — GET or POST
  if (req.method === 'GET') {
    const result = await pool.query(
      'SELECT * FROM metrics WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [user.id]
    );
    return res.json(result.rows);
  }

  if (req.method === 'POST') {
    const { name, input_type, question, frequency, active, target_value, target_unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const orderRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM metrics WHERE user_id = $1',
      [user.id]
    );
    const result = await pool.query(
      `INSERT INTO metrics (user_id, name, input_type, question, active, frequency, sort_order, target_value, target_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [user.id, name, input_type || 'binary', question || '', active ?? true, frequency || 'daily', orderRes.rows[0].next, target_value ?? null, target_unit || null]
    );
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
