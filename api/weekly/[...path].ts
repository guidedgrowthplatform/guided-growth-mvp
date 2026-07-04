/**
 * The Weekly's context endpoint. JWT-authed (requireUser, same error envelope
 * as api/onboarding/[...path].ts) — this is the client's own read of its own
 * week data, not a Vapi tool call, so it goes through the normal Supabase-JWT
 * auth model rather than X-Vapi-Secret.
 *
 * Routes:
 *   GET /api/weekly/context?timezone=IANA  — the week payload for The Weekly.
 *
 * "Today" is resolved in the client's IANA timezone (query param, validated,
 * defaults to UTC) — same pattern as api/llm/[...path].ts's checkin-tool
 * route (client sends timezone, server validates via validateTimezone).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { validateTimezone } from '../_lib/validation.js';
import {
  buildWeekData,
  renderWeekDataBlock,
  buildWeekGridPayload,
} from '../_lib/weekly/weekData.js';
import { readReflectionSettings } from '../_lib/reflection/reflectionSettings.js';

// en-CA yields YYYY-MM-DD; computing in tz avoids the server-UTC off-by-one.
// Mirrors api/_lib/llm/checkin/handlers/shared.ts's todayStr, duplicated here
// (rather than imported) since that module is Direct-LLM-checkin-scoped and
// this route is a plain JWT-authed context read, not a tool handler.
function todayStr(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  if (route === 'context' && req.method === 'GET') {
    const timezone = validateTimezone(req.query.timezone) ?? 'UTC';
    const today = todayStr(timezone);

    const [week, reflectionSettings, alreadyRanRes] = await Promise.all([
      buildWeekData(pool, user.anonId, today),
      readReflectionSettings(user.anonId),
      pool.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM weekly_sessions
            WHERE anon_id = $1
              AND completed_at IS NOT NULL
              AND week_end >= ($2::date - 6)
              AND week_end <= $2::date
         ) AS exists`,
        [user.anonId, today],
      ),
    ]);

    return res.json({
      block: renderWeekDataBlock(week),
      grid: buildWeekGridPayload(week),
      thinData: week.thinData,
      weekNumber: week.weekNumber,
      // reflection_settings.weekly_day is NULL in Postgres until the user
      // picks one (submit_weekly_config, ONBOARD-WEEKLY-SETUP). readReflection
      // Settings() already null-safes this: mapRow() defaults an absent/non-
      // integer weekly_day to DEFAULT_WEEKLY_DAY (0 = Sunday), so
      // reflectionSettings.weeklyDay here is always a number, never null.
      weeklyDay: reflectionSettings.weeklyDay,
      alreadyRanThisWeek: Boolean(alreadyRanRes.rows[0]?.exists),
    });
  }

  return res.status(404).json({ error: 'Not found' });
}
