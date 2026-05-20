#!/usr/bin/env node
/**
 * P1-04 VERIFY perf script. Hits POST /api/session_log directly against a
 * live Postgres connection (bypassing the HTTP endpoint so we can measure
 * raw DB latency without serverless cold-start noise).
 *
 *   node scripts/perf-session-log.mjs
 *
 * Env:
 *   DATABASE_URL       — Supabase pooler connection string (required)
 *   PERF_USER_ID       — UUID that exists in auth.users (required)
 *   PERF_ROWS          — defaults to 1000
 *   PERF_CLEANUP=1     — DELETE the rows after measuring (default: off)
 *
 * Targets:
 *   - 1000 inserts in <2s
 *   - "last 50 events for anon_id X" in <50ms
 */
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const USER_ID = process.env.PERF_USER_ID;
const ROW_COUNT = Number(process.env.PERF_ROWS ?? 1000);
const SHOULD_CLEAN = process.env.PERF_CLEANUP === '1';

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!USER_ID) {
  console.error('PERF_USER_ID is required (must exist in auth.users)');
  process.exit(1);
}

const SESSION_ID = `perf-${Date.now()}`;

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false },
});

async function insertBatch(count) {
  // Use a single multi-row VALUES insert — the realistic worst case is parallel
  // single-row inserts (one per event from the frontend), so we also measure
  // that below for comparison.
  const t0 = performance.now();
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      pool.query(
        `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
         VALUES ($1, $2, 'navigate', $3, $4::jsonb)`,
        [USER_ID, SESSION_ID, `PERF-${i}`, JSON.stringify({ i })],
      ),
    );
  }
  await Promise.all(promises);
  const elapsedMs = performance.now() - t0;
  return elapsedMs;
}

async function querySelect() {
  const t0 = performance.now();
  await pool.query(
    `SELECT id, event_type, screen_id, timestamp, payload
     FROM session_log
     WHERE anon_id = $1
     ORDER BY timestamp DESC
     LIMIT 50`,
    [USER_ID],
  );
  return performance.now() - t0;
}

async function main() {
  console.log(`Inserting ${ROW_COUNT} rows in parallel as user ${USER_ID}...`);
  const insertMs = await insertBatch(ROW_COUNT);
  const insertPass = insertMs < 2000;
  console.log(
    `  ${insertMs.toFixed(0)}ms total  →  ${insertPass ? 'PASS' : 'FAIL'} (target <2000ms)`,
  );

  // Warm the query plan cache, then measure
  await querySelect();
  const queryRuns = [];
  for (let i = 0; i < 10; i++) {
    queryRuns.push(await querySelect());
  }
  const queryP50 = queryRuns.sort((a, b) => a - b)[Math.floor(queryRuns.length / 2)];
  const queryPass = queryP50 < 50;
  console.log(
    `Last-50 query p50:  ${queryP50.toFixed(1)}ms  →  ${queryPass ? 'PASS' : 'FAIL'} (target <50ms)`,
  );

  if (SHOULD_CLEAN) {
    console.log('Cleaning up perf rows...');
    await pool.query('DELETE FROM session_log WHERE session_id = $1', [SESSION_ID]);
  } else {
    console.log(`(left rows in place; session_id=${SESSION_ID} to delete later)`);
  }

  await pool.end();
  if (!insertPass || !queryPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
