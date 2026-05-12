import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { handlePreflight } from '../_lib/auth.js';

// P1-40 ships /routes only. Bare /api/context is reserved for P1-05.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  if (route === 'routes' && req.method === 'GET') {
    const result = await pool.query<{ screen_id: string; route: string }>(
      `SELECT screen_id, route FROM screen_contexts WHERE route IS NOT NULL ORDER BY screen_id`,
    );
    // Overrides the global /api/(.*) no-store header so the route map can be
    // cached. Map only changes when the voice-sync cron upserts from the sheet.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).json({ routes: result.rows });
  }

  return res.status(404).json({ error: 'Not found' });
}
