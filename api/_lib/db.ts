import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  max: 1,
  idleTimeoutMillis: 10000,
});

export default pool;
