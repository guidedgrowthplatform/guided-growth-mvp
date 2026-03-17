import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BULK_ENTRIES = 500;

function validateDate(val: unknown): val is string {
  return typeof val === 'string' && DATE_RE.test(val);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : (segments[0] || '');

  // GET /api/entries/export?start=&end=
  if (route === 'export' && req.method === 'GET') {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });
    if (!validateDate(start) || !validateDate(end)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

    const [metricsResult, entriesResult] = await Promise.all([
      pool.query('SELECT id, name FROM metrics WHERE user_id = $1 ORDER BY sort_order', [user.id]),
      pool.query(
        'SELECT metric_id, date::text, value FROM entries WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date',
        [user.id, start, end]
      ),
    ]);

    const metrics = metricsResult.rows as { id: string; name: string }[];
    const entryMap: Record<string, Record<string, string>> = {};
    for (const row of entriesResult.rows) {
      if (!entryMap[row.date]) entryMap[row.date] = {};
      entryMap[row.date][row.metric_id] = row.value;
    }

    // Build CSV
    const header = ['Date', ...metrics.map((m) => `"${m.name.replace(/"/g, '""')}"`)]
      .join(',');
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
    const safeStart = (start as string).replace(/[^0-9-]/g, '');
    const safeEnd = (end as string).replace(/[^0-9-]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="habits-${safeStart}-to-${safeEnd}.csv"`);
    return res.send(csv);
  }

  // UUID format validation helper
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // PUT /api/entries/bulk
  if (route === 'bulk') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const bodyEntries = Object.entries(req.body || {});
    if (bodyEntries.length > MAX_BULK_ENTRIES) return res.status(400).json({ error: 'Too many entries in single request' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [date, dayEntries] of bodyEntries) {
        if (!validateDate(date)) continue;
        for (const [metricId, value] of Object.entries(dayEntries as Record<string, string>)) {
          if (!UUID_RE.test(metricId)) continue; // skip invalid metric IDs
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
      console.error('Bulk save failed:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    } finally {
      client.release();
    }
    return res.json({ message: 'Saved' });
  }

  // PUT /api/entries/:date
  if (route && route !== 'bulk') {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const date = route;
    if (!validateDate(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    const bodyEntries = Object.entries(req.body || {});
    if (bodyEntries.length > MAX_BULK_ENTRIES) return res.status(400).json({ error: 'Too many entries in single request' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [metricId, value] of bodyEntries) {
        if (!UUID_RE.test(metricId)) continue; // skip invalid metric IDs
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
      console.error('Save entry failed:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    } finally {
      client.release();
    }
    return res.json({ message: 'Saved' });
  }

  // GET /api/entries?start=&end=
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  if (!validateDate(start) || !validateDate(end)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

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
