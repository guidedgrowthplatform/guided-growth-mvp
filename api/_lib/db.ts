import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.SUPABASE_SSL_CERT
    ? { ca: process.env.SUPABASE_SSL_CERT, rejectUnauthorized: true }
    : { rejectUnauthorized: false },
  max: 1,
  // keep the warm-instance socket alive between calls — cold pooler connect is ~2.8s
  idleTimeoutMillis: 60000,
});

export default pool;
