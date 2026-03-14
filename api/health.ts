import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, string> = {};

  // Check if critical env vars are configured (don't leak names)
  const allSecretsSet = !!(
    process.env.OPENAI_API_KEY &&
    process.env.DEEPGRAM_API_KEY &&
    process.env.VITE_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SESSION_SECRET
  );
  checks.secrets = allSecretsSet ? 'all configured' : 'missing';

  // Check DATABASE_URL (optional — app can run with Supabase JS client alone)
  if (process.env.DATABASE_URL) {
    try {
      const pg = await import('pg');
      const pool = new pg.default.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      await pool.query('SELECT 1');
      await pool.end();
      checks.database = 'connected';
    } catch (err: any) {
      checks.database = 'error';
    }
  } else {
    checks.database = 'not configured (using Supabase JS client)';
  }

  const hasCriticalMissing = !allSecretsSet;

  res.status(hasCriticalMissing ? 503 : 200).json({
    status: hasCriticalMissing ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    checks,
  });
}
