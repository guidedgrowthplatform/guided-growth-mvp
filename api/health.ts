import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, string> = {};

  // Check if critical env vars are configured
  checks.OPENAI_API_KEY = process.env.OPENAI_API_KEY ? 'set' : 'missing';
  checks.DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY ? 'set' : 'missing';
  checks.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ? 'set' : 'missing';
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing';
  checks.SESSION_SECRET = process.env.SESSION_SECRET ? 'set' : 'missing';

  // Check DATABASE_URL (optional — app can run with Supabase JS client alone)
  if (process.env.DATABASE_URL) {
    try {
      const pg = await import('pg');
      const pool = new pg.default.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      await pool.query('SELECT 1');
      await pool.end();
      checks.DATABASE_URL = 'connected';
    } catch (err: any) {
      checks.DATABASE_URL = `error: ${err.message}`;
    }
  } else {
    checks.DATABASE_URL = 'not configured (using Supabase JS client)';
  }

  const hasCriticalMissing = checks.OPENAI_API_KEY === 'missing' ||
    checks.VITE_SUPABASE_URL === 'missing';

  res.status(hasCriticalMissing ? 503 : 200).json({
    status: hasCriticalMissing ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    checks,
  });
}
