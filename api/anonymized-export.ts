import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import pool from './_lib/db.js';
import { handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

function sha256(value: string): string {
  return `anon_${createHash('sha256').update(value).digest('hex')}`;
}

function anonymizeUser(row: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...row };
  if (typeof copy.email === 'string') copy.email = sha256(copy.email);
  if (typeof copy.name === 'string') copy.name = sha256(copy.name);
  if (typeof copy.nickname === 'string') copy.nickname = sha256(copy.nickname);
  if (typeof copy.user_id === 'string') copy.user_id = sha256(copy.user_id);
  return copy;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate admin key
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(500).json({ error: 'Server misconfigured: ADMIN_API_KEY not set' });
  }

  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ error: 'Invalid or missing x-admin-key header' });
  }

  // Rate limit: 10 requests per 5 minutes per IP
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(clientIp, {
    windowMs: 5 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'anon-export',
  });
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60));
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter });
  }

  try {
    const [habits, checkins, journals, focusSessions] = await Promise.all([
      pool.query(
        'SELECT id, user_id, name, cadence, is_active, created_at FROM user_habits ORDER BY created_at',
      ),
      pool.query(
        'SELECT id, user_id, date, sleep_quality, mood_score, energy_level, stress_level, created_at FROM daily_checkins ORDER BY date',
      ),
      pool.query(
        'SELECT id, user_id, date, prompt, response, input_mode, created_at FROM journal_entries ORDER BY date',
      ),
      pool.query(
        'SELECT id, user_id, user_habit_id, duration_minutes, actual_minutes, status, started_at FROM focus_sessions ORDER BY started_at',
      ),
    ]);

    return res.status(200).json({
      exported_at: new Date().toISOString(),
      habits: habits.rows.map(anonymizeUser),
      checkins: checkins.rows.map(anonymizeUser),
      journal_entries: journals.rows.map(anonymizeUser),
      focus_sessions: focusSessions.rows.map(anonymizeUser),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Export failed: ${message}` });
  }
}
