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

// Either the pool (autocommit) or a checked-out client inside a transaction.
// Handlers accept this so the Vapi webhook can run a whole tool-call batch in
// ONE transaction (so multiple writes to the same onboarding_states row
// coalesce into a single Realtime event), while standalone callers keep the
// default pool. NOTE: the pool is max:1 — inside a transaction every query MUST
// use the checked-out client, never the default pool, or it self-deadlocks.
export type Queryable = Pick<pg.Pool, 'query'>;

export default pool;
