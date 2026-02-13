import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set!');
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl:
    env.IS_PRODUCTION ||
    env.DATABASE_URL?.includes('supabase.co') ||
    env.DATABASE_URL?.includes('pooler.supabase.com')
      ? { rejectUnauthorized: false }
      : false,
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  if (!env.IS_VERCEL) {
    process.exit(-1);
  }
});

export default pool;
