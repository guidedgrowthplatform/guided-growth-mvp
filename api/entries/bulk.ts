import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db';
import { requireUser } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireUser(req, res);
  if (!user) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [date, dayEntries] of Object.entries(req.body)) {
      for (const [metricId, value] of Object.entries(dayEntries as Record<string, string>)) {
        if (value === '' || value === null || value === undefined) {
          await client.query('DELETE FROM entries WHERE user_id = $1 AND metric_id = $2 AND date = $3', [user.id, metricId, date]);
        } else {
          await client.query(
            `INSERT INTO entries (user_id, metric_id, date, value) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, metric_id, date) DO UPDATE SET value = $4`,
            [user.id, metricId, date, String(value)]
          );
        }
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
