#!/usr/bin/env node
/**
 * P1-05 VERIFY perf script. Hits the same DB queries + in-process cache
 * the /api/context handler uses, in a single Node process. Bypasses HTTP
 * to avoid serverless cold-start noise (same pattern as perf-session-log.mjs).
 *
 *   node scripts/perf-context.mjs              # VERIFY-1 latency run
 *   node scripts/perf-context.mjs --invalidate # VERIFY-2 cache invalidation
 *
 * Env:
 *   DATABASE_URL       — Supabase pooler connection string (required)
 *   PERF_USER_ID       — UUID with rows in session_log (required)
 *   PERF_SCREEN_ID     — screen_contexts row to read (default: AUTH-LOGIN)
 *   PERF_ROWS          — request count (default: 1000)
 *
 * Targets (P1-05):
 *   - p50 < 80ms,  p99 < 250ms over 1000 synthetic requests
 *   - Stale cache invalidates within 60s of a DB version bump
 */
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const USER_ID = process.env.PERF_USER_ID;
const SCREEN_ID = process.env.PERF_SCREEN_ID ?? 'AUTH-LOGIN';
const ROW_COUNT = Number(process.env.PERF_ROWS ?? 1000);
const MODE = process.argv.includes('--invalidate') ? 'invalidate' : 'perf';

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!USER_ID) {
  console.error('PERF_USER_ID is required (a UUID with rows in session_log)');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false },
});

// Mirrors api/context/[...path].ts
const CONTEXT_CACHE_TTL_MS = 60_000;
const STATE_DELTA_LIMIT = 15;

function makeCache() {
  return new Map();
}

function getCached(cache, screenId) {
  const cached = cache.get(screenId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CONTEXT_CACHE_TTL_MS) {
    cache.delete(screenId);
    return null;
  }
  return cached;
}

async function fetchContextBlock(cache, screenId) {
  const cached = getCached(cache, screenId);
  if (cached) return { ...cached, cacheHit: true };
  const r = await pool.query(
    `SELECT context_block, version FROM screen_contexts WHERE screen_id = $1`,
    [screenId],
  );
  if (r.rowCount === 0) throw new Error(`Unknown screen_id: ${screenId}`);
  const row = r.rows[0];
  const entry = { context_block: row.context_block, version: row.version, fetchedAt: Date.now() };
  cache.set(screenId, entry);
  return { ...entry, cacheHit: false };
}

async function fetchStateDelta(userId, sinceTs) {
  await pool.query(
    `SELECT id, session_id, timestamp, event_type, screen_id, payload
       FROM session_log
      WHERE user_id = $1 AND timestamp > $2
      ORDER BY timestamp ASC
      LIMIT $3`,
    [userId, sinceTs, STATE_DELTA_LIMIT],
  );
}

function summarise(label, samplesMs, p50Target, p99Target) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p50 = pct(50);
  const p95 = pct(95);
  const p99 = pct(99);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const pass50 = p50Target == null || p50 < p50Target;
  const pass99 = p99Target == null || p99 < p99Target;
  const verdict = pass50 && pass99 ? 'PASS' : 'FAIL';
  console.log(`\n${label}  (${sorted.length} samples)`);
  console.log(
    `  min ${min.toFixed(2)}  p50 ${p50.toFixed(2)}  p95 ${p95.toFixed(2)}  p99 ${p99.toFixed(2)}  max ${max.toFixed(2)}  mean ${mean.toFixed(2)}  ms`,
  );
  if (p50Target != null || p99Target != null) {
    console.log(
      `  → ${verdict}  (target p50 < ${p50Target ?? '–'}ms, p99 < ${p99Target ?? '–'}ms)`,
    );
  }
  return { p50, p99, pass: pass50 && pass99 };
}

async function runPerf() {
  console.log(`PERF run: ${ROW_COUNT} sequential requests, screen_id=${SCREEN_ID}`);

  // 1. Cold-cache block fetch: every request misses (fresh cache each time)
  const coldBlockMs = [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const cache = makeCache();
    const t0 = performance.now();
    await fetchContextBlock(cache, SCREEN_ID);
    coldBlockMs.push(performance.now() - t0);
  }
  const r1 = summarise('GET /api/context  (cold cache — DB every request)', coldBlockMs, 80, 250);

  // 2. Warm-cache block fetch: shared cache, 1 miss + N-1 hits
  const warmCache = makeCache();
  await fetchContextBlock(warmCache, SCREEN_ID);
  const warmBlockMs = [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const t0 = performance.now();
    await fetchContextBlock(warmCache, SCREEN_ID);
    warmBlockMs.push(performance.now() - t0);
  }
  summarise('GET /api/context  (warm cache — in-process hits)', warmBlockMs, null, null);

  // 3. State delta: never cached
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const deltaMs = [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const t0 = performance.now();
    await fetchStateDelta(USER_ID, since);
    deltaMs.push(performance.now() - t0);
  }
  const r3 = summarise('GET /api/context/state  (no cache — DB every request)', deltaMs, 80, 250);

  const overallPass = r1.pass && r3.pass;
  console.log(
    `\nOVERALL: ${overallPass ? 'PASS' : 'FAIL'}  (cold-block & state-delta must both hit p50<80, p99<250)`,
  );
  await pool.end();
  if (!overallPass) process.exit(1);
}

async function runInvalidate() {
  // Use a synthetic screen so we can mutate version freely
  const testScreenId = `PERF-TEST-${Date.now()}`;
  console.log(`INVALIDATE run: screen_id=${testScreenId}, TTL=${CONTEXT_CACHE_TTL_MS}ms`);

  await pool.query(
    `INSERT INTO screen_contexts
       (screen_id, context_block, content_hash, source_row, version, route)
     VALUES ($1, $2, md5($2), '{}'::jsonb, 1, '/perf')`,
    [testScreenId, 'perf-test-block-v1'],
  );

  try {
    const cache = makeCache();

    const first = await fetchContextBlock(cache, testScreenId);
    console.log(`  t=0      version=${first.version}  cacheHit=${first.cacheHit}  (initial)`);
    if (first.version !== 1) throw new Error('expected version=1 on first fetch');

    // Simulate sheet→DB sync bumping the row
    await pool.query(
      `UPDATE screen_contexts
          SET context_block=$2, content_hash=md5($2), version=version+1, updated_at=NOW()
        WHERE screen_id=$1`,
      [testScreenId, 'perf-test-block-v2'],
    );
    console.log(`  t≈0      DB updated to version=2 (simulated sheet→DB sync)`);

    // Sanity: cache should still serve stale value before TTL
    const stillCached = await fetchContextBlock(cache, testScreenId);
    console.log(
      `  t≈0+ε    version=${stillCached.version}  cacheHit=${stillCached.cacheHit}  (should be 1/true)`,
    );
    if (stillCached.version !== 1 || !stillCached.cacheHit) {
      throw new Error('cache did not serve stale within TTL — implementation drift');
    }

    // Poll until invalidation, capped at TTL + 5s safety margin
    const start = performance.now();
    const deadline = start + CONTEXT_CACHE_TTL_MS + 5_000;
    let observedAt = null;
    while (performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      const elapsed = performance.now() - start;
      const probe = await fetchContextBlock(cache, testScreenId);
      if (probe.version === 2) {
        observedAt = elapsed;
        console.log(
          `  t=${(elapsed / 1000).toFixed(1)}s   version=${probe.version}  cacheHit=${probe.cacheHit}  (INVALIDATED)`,
        );
        break;
      }
    }

    if (observedAt == null) {
      console.log('\nFAIL: cache did not invalidate within TTL + 5s');
      process.exit(1);
    }
    const pass = observedAt <= CONTEXT_CACHE_TTL_MS + 1500; // 1.5s polling jitter
    console.log(
      `\n${pass ? 'PASS' : 'FAIL'}: observed invalidation at ${(observedAt / 1000).toFixed(2)}s (target ≤ 60s)`,
    );
    if (!pass) process.exit(1);
  } finally {
    await pool.query(`DELETE FROM screen_contexts WHERE screen_id = $1`, [testScreenId]);
    await pool.end();
  }
}

(MODE === 'invalidate' ? runInvalidate() : runPerf()).catch((err) => {
  console.error(err);
  process.exit(1);
});
