import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';
import pool from './_lib/db.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS must run before method check so preflight OPTIONS can succeed
  // from the Capacitor Android WebView (https://localhost origin).
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 30, keyPrefix: 'health' });
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
}
