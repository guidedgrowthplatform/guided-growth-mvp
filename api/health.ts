import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './_lib/db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
}
