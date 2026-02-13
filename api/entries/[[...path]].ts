import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  const segments = (req.query.path as string[] | undefined) || [];
  const route = segments[0] || '';

  // PUT /api/entries/bulk
  if (route === 'bulk') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
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
    return res.json({ message: 'Saved' });
  }

  // PUT /api/entries/:date
  if (route && route !== 'bulk') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const date = route;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [metricId, value] of Object.entries(req.body)) {
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
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return res.json({ message: 'Saved' });
  }

  // GET /api/entries?start=&end=
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });

  const result = await pool.query(
    'SELECT metric_id, date::text, value FROM entries WHERE user_id = $1 AND date >= $2 AND date <= $3',
    [user.id, start, end]
  );

  const map: Record<string, Record<string, string>> = {};
  for (const row of result.rows) {
    if (!map[row.date]) map[row.date] = {};
    map[row.date][row.metric_id] = row.value;
  }
  res.json(map);
}
