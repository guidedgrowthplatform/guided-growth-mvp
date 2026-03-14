import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

const DEFAULT_FIELDS = [
  { id: 'wins', label: 'Wins', order: 0 },
  { id: 'challenges', label: 'Challenges', order: 1 },
  { id: 'gratitude', label: 'Gratitude', order: 2 },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : (segments[0] || '');

  // GET/PUT /api/reflections/config
  if (route === 'config') {
    if (req.method === 'GET') {
      const result = await pool.query('SELECT fields, show_affirmation FROM reflection_configs WHERE user_id = $1', [user.id]);
      if (result.rows.length === 0) return res.json({ fields: DEFAULT_FIELDS, show_affirmation: true });
      return res.json(result.rows[0]);
    }
    if (req.method === 'PUT') {
      const { fields, show_affirmation } = req.body;
      await pool.query(
        `INSERT INTO reflection_configs (user_id, fields, show_affirmation) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET fields = $2, show_affirmation = $3`,
        [user.id, JSON.stringify(fields), show_affirmation]
      );
      return res.json({ fields, show_affirmation });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // PUT /api/reflections/:date
  if (route) {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    const date = route;
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    const bodyEntries = Object.entries(req.body || {});
    if (bodyEntries.length > 50) return res.status(400).json({ error: 'Too many fields' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [fieldId, value] of bodyEntries) {
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
      console.error('Save reflection failed:', err);
      return res.status(500).json({ error: 'Failed to save reflection' });
    } finally {
      client.release();
    }
    return res.json({ message: 'Saved' });
  }

  // GET /api/reflections?start=&end=
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  const DATE_RE2 = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE2.test(start as string) || !DATE_RE2.test(end as string)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

  const result = await pool.query(
    'SELECT date::text, field_id, value FROM reflections WHERE user_id = $1 AND date >= $2 AND date <= $3',
    [user.id, start, end]
  );

  const map: Record<string, Record<string, string>> = {};
  for (const row of result.rows) {
    if (!map[row.date]) map[row.date] = {};
    map[row.date][row.field_id] = row.value;
  }
  res.json(map);
}
