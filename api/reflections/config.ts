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

  res.status(405).json({ error: 'Method not allowed' });
}
