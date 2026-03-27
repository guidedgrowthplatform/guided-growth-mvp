import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.id);

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // GET /api/entries/export?start=&end=
  if (route === 'export' && req.method === 'GET') {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });

    const [metricsResult, entriesResult] = await Promise.all([
      pool.query('SELECT id, name FROM metrics WHERE user_id = $1 ORDER BY sort_order', [user.id]),
      pool.query(
        'SELECT metric_id, date::text, value FROM entries WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date',
        [user.id, start, end],
      ),
    ]);

    const metrics = metricsResult.rows as { id: string; name: string }[];
    const entryMap: Record<string, Record<string, string>> = {};
    for (const row of entriesResult.rows) {
      if (!entryMap[row.date]) entryMap[row.date] = {};
      entryMap[row.date][row.metric_id] = row.value;
    }

    // Build CSV
    const header = ['Date', ...metrics.map((m) => `"${m.name.replace(/"/g, '""')}"`)].join(',');
    const dates = Object.keys(entryMap).sort();
    const rows = dates.map((date) => {
      const values = metrics.map((m) => {
        const v = entryMap[date]?.[m.id] || '';
        return `"${v.replace(/"/g, '""')}"`;
      });
      return [date, ...values].join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="habits-${start}-to-${end}.csv"`);
    return res.send(csv);
  }

  // PUT /api/entries/bulk
  if (route === 'bulk') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [date, dayEntries] of Object.entries(req.body)) {
        for (const [metricId, value] of Object.entries(dayEntries as Record<string, string>)) {
          if (value === '' || value === null || value === undefined) {
            await client.query(
              'DELETE FROM entries WHERE user_id = $1 AND metric_id = $2 AND date = $3',
              [user.id, metricId, date],
            );
          } else {
            await client.query(
              `INSERT INTO entries (user_id, metric_id, date, value) VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, metric_id, date) DO UPDATE SET value = $4`,
              [user.id, metricId, date, String(value)],
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
          await client.query(
            'DELETE FROM entries WHERE user_id = $1 AND metric_id = $2 AND date = $3',
            [user.id, metricId, date],
          );
        } else {
          await client.query(
            `INSERT INTO entries (user_id, metric_id, date, value) VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, metric_id, date) DO UPDATE SET value = $4`,
            [user.id, metricId, date, String(value)],
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
    [user.id, start, end],
  );

  const map: Record<string, Record<string, string>> = {};
  for (const row of result.rows) {
    if (!map[row.date]) map[row.date] = {};
    map[row.date][row.metric_id] = row.value;
  }
  res.json(map);
}
