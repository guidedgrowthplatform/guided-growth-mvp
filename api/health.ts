import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, string> = {};

  // Check database using shared pool (inherits correct SSL config)
  try {
    await pool.query('SELECT 1');
    checks.database = 'connected';
  } catch {
    checks.database = 'error';
  }

  // Only report status, not which specific secrets are missing
  const healthy = checks.database === 'connected';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: { database: checks.database },
  });
}
