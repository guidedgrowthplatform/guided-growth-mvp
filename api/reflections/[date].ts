import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireUser(req, res);
  if (!user) return;

  const date = req.query.date as string;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [fieldId, value] of Object.entries(req.body)) {
      if (value === '' || value === null || value === undefined) {
        await client.query('DELETE FROM reflections WHERE user_id = $1 AND date = $2 AND field_id = $3', [user.id, date, fieldId]);
      } else {
        await client.query(
          `INSERT INTO reflections (user_id, date, field_id, value) VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, date, field_id) DO UPDATE SET value = $4`,
          [user.id, date, fieldId, value]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json({ message: 'Saved' });
}
