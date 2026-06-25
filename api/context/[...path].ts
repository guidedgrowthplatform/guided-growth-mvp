import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';

// P1-05 split:
//   GET /api/context?screen_id=X       → { screen_id, context_block, version }
//   GET /api/context/state?since_ts=Z  → { state_delta: [...] }
// Context block is per-screen and changes only on sheet→DB resync, so we
// cache it in-process for 60s. State delta is per-user and always fresh.

interface ScreenContextRow {
  context_block: string;
  version: number;
}

interface StateDeltaRow {
  id: string;
  session_id: string;
  timestamp: Date;
  event_type: string;
  screen_id: string | null;
  payload: Record<string, unknown> | null;
}

interface CachedContext {
  context_block: string;
  version: number;
  fetchedAt: number;
}

const CONTEXT_CACHE_TTL_MS = 60_000;
const STATE_DELTA_LIMIT = 15;
const SCREEN_ID_MAX_LEN = 200;

const contextCache = new Map<string, CachedContext>();

function getCachedContext(screenId: string): CachedContext | null {
  const cached = contextCache.get(screenId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CONTEXT_CACHE_TTL_MS) {
    contextCache.delete(screenId);
    return null;
  }
  return cached;
}

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  if (route === 'routes' && req.method === 'GET') {
    try {
      const result = await pool.query<{ screen_id: string; route: string }>(
        `SELECT screen_id, route FROM screen_contexts WHERE route IS NOT NULL ORDER BY screen_id`,
      );
      // Overrides the global /api/(.*) no-store header so the route map can be
      // cached. Map only changes when the voice-sync cron upserts from the sheet.
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      return res.status(200).json({ routes: result.rows });
    } catch (e) {
      console.error('[context/routes] query failed', e);
      return res.status(503).json({ error: 'Route map temporarily unavailable' });
    }
  }

  if (route === '' && req.method === 'GET') {
    const user = await requireUser(req, res);
    if (!user) return;
    await setUserContext(user.anonId);

    const rawScreenId = req.query.screen_id;
    const screenId =
      typeof rawScreenId === 'string' ? rawScreenId.trim().slice(0, SCREEN_ID_MAX_LEN) : '';
    if (!screenId) {
      return res.status(400).json({ error: 'screen_id is required' });
    }

    let cached = getCachedContext(screenId);
    const cacheHit = cached !== null;
    if (!cached) {
      const ctxResult = await pool.query<ScreenContextRow>(
        `SELECT context_block, version FROM screen_contexts WHERE screen_id = $1`,
        [screenId],
      );
      if (ctxResult.rowCount === 0) {
        return res.status(404).json({ error: 'Unknown screen_id' });
      }
      const row = ctxResult.rows[0];
      cached = {
        context_block: row.context_block,
        version: row.version,
        fetchedAt: Date.now(),
      };
      contextCache.set(screenId, cached);
    }

    res.setHeader('X-Context-Cache', cacheHit ? 'hit' : 'miss');
    return res.status(200).json({
      screen_id: screenId,
      context_block: cached.context_block,
      version: cached.version,
    });
  }

  if (route === 'state' && req.method === 'GET') {
    const user = await requireUser(req, res);
    if (!user) return;
    await setUserContext(user.anonId);

    const sinceTs = parseIsoTimestamp(req.query.since_ts);
    if (!sinceTs) {
      return res.status(400).json({ error: 'since_ts must be a valid ISO timestamp' });
    }

    const result = await pool.query<StateDeltaRow>(
      `SELECT id, session_id, timestamp, event_type, screen_id, payload
         FROM session_log
        WHERE anon_id = $1 AND timestamp > $2
        ORDER BY timestamp ASC
        LIMIT $3`,
      [user.anonId, sinceTs, STATE_DELTA_LIMIT],
    );

    return res.status(200).json({ state_delta: result.rows });
  }

  return res.status(404).json({ error: 'Not found' });
}
