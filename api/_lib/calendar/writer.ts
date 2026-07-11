import pool, { type Queryable } from '../db.js';
import { CalendarApiError, getValidAccessToken } from './google.js';
import { readReflectionSettings } from '../reflection/reflectionSettings.js';
import { validateTimezone } from '../validation.js';
import { buildRrule, buildWeeklyRrule } from './rrule.js';
import {
  buildEventResource,
  deleteEvent,
  ensureGgCalendar,
  insertEvent,
  patchEvent,
  type RitualEvent,
} from './events.js';

// A5 — materialize the user's rituals as recurring Google Calendar events,
// idempotently. Re-run PATCHes (never duplicates) via calendar_event_map.

interface DesiredRitual extends RitualEvent {
  ritual_type: string;
}

// The Weekly has no dedicated time column — fall back when reflection time is unset.
const DEFAULT_WEEKLY_TIME = '09:00';

interface PrefsRow {
  morning_time?: string | null;
  night_time?: string | null;
  timezone?: string | null;
}

interface HabitRow {
  id: string;
  name: string | null;
  schedule_days: number[] | null;
  reminder_time: string | null;
  reminder_enabled: boolean;
}

interface ExistingRow {
  ritual_type: string;
  calendar_id: string;
  google_event_id: string;
}

async function buildDesiredRituals(
  db: Queryable,
  anonId: string,
  prefs: PrefsRow | undefined,
): Promise<DesiredRitual[]> {
  const out: DesiredRitual[] = [];

  if (prefs?.morning_time) {
    out.push({
      ritual_type: 'morning_checkin',
      summary: 'Morning check-in',
      time: prefs.morning_time,
      rrule: buildRrule(null),
    });
  }
  if (prefs?.night_time) {
    out.push({
      ritual_type: 'evening_checkin',
      summary: 'Evening check-in',
      time: prefs.night_time,
      rrule: buildRrule(null),
    });
  }

  const rs = await readReflectionSettings(anonId);
  if (rs.reminder && rs.time) {
    out.push({
      ritual_type: 'evening_reflection',
      summary: 'Evening reflection',
      time: rs.time,
      rrule: buildRrule(rs.days),
    });
  }

  // The Weekly has no reminder flag — its only signal is weekly_day. NULL = "not
  // chosen yet" (migration 055), which readReflectionSettings collapses to 0, so
  // read it raw and only write when the user actually picked a day.
  const wd = await db.query(`SELECT weekly_day FROM reflection_settings WHERE anon_id = $1`, [
    anonId,
  ]);
  const rawWeeklyDay = (wd.rows[0] as { weekly_day: number | null } | undefined)?.weekly_day;
  if (rawWeeklyDay != null) {
    out.push({
      ritual_type: 'weekly',
      summary: 'The Weekly',
      time: rs.time ?? DEFAULT_WEEKLY_TIME,
      rrule: buildWeeklyRrule(rawWeeklyDay),
    });
  }

  const habits = await db.query(
    `SELECT id, name, schedule_days, reminder_time, reminder_enabled FROM user_habits
      WHERE anon_id = $1 AND is_active = true AND archived_at IS NULL
      ORDER BY sort_order ASC`,
    [anonId],
  );
  for (const h of habits.rows as HabitRow[]) {
    if (h.reminder_enabled && h.reminder_time) {
      out.push({
        ritual_type: `habit:${h.id}`,
        summary: h.name || 'Habit',
        time: h.reminder_time,
        rrule: buildRrule(h.schedule_days),
      });
    }
  }

  return out;
}

// Prevents two overlapping syncs for one user (rapid double-trigger) from both
// inserting — which would duplicate events / create two GG calendars.
const inFlight = new Set<string>();

// Throws CalendarNotConnected/Disabled/Reauth (getValidAccessToken) — caller maps to HTTP.
export async function runSync(
  anonId: string,
  db: Queryable = pool,
): Promise<{ written: number; deleted: number; skipped?: boolean }> {
  if (inFlight.has(anonId)) return { written: 0, deleted: 0, skipped: true };
  inFlight.add(anonId);
  try {
    return await runSyncInner(anonId, db);
  } finally {
    inFlight.delete(anonId);
  }
}

async function runSyncInner(
  anonId: string,
  db: Queryable,
): Promise<{ written: number; deleted: number }> {
  const token = await getValidAccessToken(anonId);

  const connRes = await db.query(
    `SELECT target, gg_calendar_id FROM calendar_connections WHERE anon_id = $1`,
    [anonId],
  );
  const conn = connRes.rows[0] as { target?: string; gg_calendar_id?: string | null } | undefined;
  const target = conn?.target === 'own' ? 'own' : 'gg';

  const prefsRes = await db.query(
    `SELECT morning_time, night_time, timezone FROM user_preferences WHERE anon_id = $1`,
    [anonId],
  );
  const prefs = prefsRes.rows[0] as PrefsRow | undefined;
  const tz = validateTimezone(prefs?.timezone) ?? 'UTC';

  const calendarId =
    target === 'own'
      ? 'primary'
      : (conn?.gg_calendar_id ?? (await ensureGgCalendar(token, db, anonId, tz)));

  const desired = await buildDesiredRituals(db, anonId, prefs);

  const existingRes = await db.query(
    `SELECT ritual_type, calendar_id, google_event_id FROM calendar_event_map WHERE anon_id = $1`,
    [anonId],
  );
  const existing = existingRes.rows as ExistingRow[];

  const upsertMap = (ritualType: string, eventId: string, rrule: string) =>
    db.query(
      `INSERT INTO calendar_event_map (anon_id, ritual_type, calendar_id, google_event_id, rrule)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (anon_id, ritual_type, calendar_id) DO UPDATE
         SET google_event_id = EXCLUDED.google_event_id, rrule = EXCLUDED.rrule, updated_at = now()`,
      [anonId, ritualType, calendarId, eventId, rrule],
    );

  let written = 0;
  for (const d of desired) {
    const resource = buildEventResource(d, tz);
    const prior = existing.find(
      (e) => e.ritual_type === d.ritual_type && e.calendar_id === calendarId,
    );
    try {
      if (prior) {
        const patched = await patchEvent(token, calendarId, prior.google_event_id, resource);
        if (patched) {
          await db.query(
            `UPDATE calendar_event_map SET rrule = $4, updated_at = now()
              WHERE anon_id = $1 AND ritual_type = $2 AND calendar_id = $3`,
            [anonId, d.ritual_type, calendarId, d.rrule],
          );
        } else {
          // User deleted the event at Google — recreate it and re-point the map.
          const eventId = await insertEvent(token, calendarId, resource);
          await upsertMap(d.ritual_type, eventId, d.rrule);
        }
      } else {
        const eventId = await insertEvent(token, calendarId, resource);
        await upsertMap(d.ritual_type, eventId, d.rrule);
      }
      written++;
    } catch (err) {
      // A Google API failure on one ritual (e.g. its calendar was deleted) must not
      // abort the whole sync — skip it, let the rest + reap proceed. Auth failures
      // and real bugs still propagate (route maps reauth → 401).
      if (err instanceof CalendarApiError && err.status !== 401 && err.status !== 403) {
        console.warn('[calendar] ritual sync failed, skipped', d.ritual_type, err.status);
        continue;
      }
      throw err;
    }
  }

  // Reap events no longer desired, or stranded on the old calendar after a target switch.
  const desiredKeys = new Set(desired.map((d) => `${d.ritual_type}::${calendarId}`));
  let deleted = 0;
  for (const e of existing) {
    if (desiredKeys.has(`${e.ritual_type}::${e.calendar_id}`)) continue;
    // Keep the map row if the delete truly failed (transient) so a later sync retries.
    const gone = await deleteEvent(token, e.calendar_id, e.google_event_id);
    if (!gone) continue;
    await db.query(
      `DELETE FROM calendar_event_map WHERE anon_id = $1 AND ritual_type = $2 AND calendar_id = $3`,
      [anonId, e.ritual_type, e.calendar_id],
    );
    deleted++;
  }

  return { written, deleted };
}
