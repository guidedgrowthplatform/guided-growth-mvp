import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.SUPABASE_SSL_CERT
    ? { ca: process.env.SUPABASE_SSL_CERT, rejectUnauthorized: true }
    : { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 10000,
});

export default pool;
