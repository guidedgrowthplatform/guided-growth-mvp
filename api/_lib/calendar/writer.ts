import pool, { type Queryable } from '../db.js';
import { CalendarApiError, getValidAccessToken } from './google.js';
import { readRawWeeklyDay, readReflectionSettings } from '../reflection/reflectionSettings.js';
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
      days: null,
    });
  }
  if (prefs?.night_time) {
    out.push({
      ritual_type: 'evening_checkin',
      summary: 'Evening check-in',
      time: prefs.night_time,
      rrule: buildRrule(null),
      days: null,
    });
  }

  const rs = await readReflectionSettings(anonId);
  if (rs.reminder && rs.time) {
    out.push({
      ritual_type: 'evening_reflection',
      summary: 'Evening reflection',
      time: rs.time,
      rrule: buildRrule(rs.days),
      days: rs.days,
    });
  }

  // Only when a weekly_day was actually chosen (NULL = never).
  const rawWeeklyDay = await readRawWeeklyDay(anonId);
  if (rawWeeklyDay != null) {
    out.push({
      ritual_type: 'weekly',
      summary: 'The Weekly',
      time: rs.time ?? DEFAULT_WEEKLY_TIME,
      rrule: buildWeeklyRrule(rawWeeklyDay),
      days: [rawWeeklyDay],
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
        // h: not habit: — fit VARCHAR(40) with a 36-char UUID
        ritual_type: `h:${h.id}`,
        summary: h.name || 'Habit',
        time: h.reminder_time,
        rrule: buildRrule(h.schedule_days),
        days: h.schedule_days,
      });
    }
  }

  return out;
}

// Same-instance guard; the advisory lock below covers cross-instance.
const inFlight = new Set<string>();

// Throws CalendarNotConnected/Disabled/Reauth (getValidAccessToken) — caller maps to HTTP.
export async function runSync(
  anonId: string,
  db: Queryable = pool,
): Promise<{ written: number; deleted: number; skipped?: boolean }> {
  if (inFlight.has(anonId)) return { written: 0, deleted: 0, skipped: true };
  inFlight.add(anonId);
  try {
    // Cross-instance guard — skip if another instance holds it.
    const lock = await db.query(`SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked`, [
      anonId,
    ]);
    if (!(lock.rows[0] as { locked?: boolean } | undefined)?.locked) {
      return { written: 0, deleted: 0, skipped: true };
    }
    try {
      return await runSyncInner(anonId, db);
    } finally {
      await db
        .query(`SELECT pg_advisory_unlock(hashtextextended($1, 0))`, [anonId])
        .catch(() => {});
    }
  } finally {
    inFlight.delete(anonId);
  }
}

// Best-effort — a map-write blip must not abort the whole sync.
async function safeDbWrite(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn('[calendar] map write failed, continuing', label, e);
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

  const doInsert = async (d: DesiredRitual, resource: Record<string, unknown>) => {
    const eventId = await insertEvent(token, calendarId, resource);
    await safeDbWrite(() => upsertMap(d.ritual_type, eventId, d.rrule), d.ritual_type);
  };

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
          await safeDbWrite(
            () =>
              db.query(
                `UPDATE calendar_event_map SET rrule = $4, updated_at = now()
                  WHERE anon_id = $1 AND ritual_type = $2 AND calendar_id = $3`,
                [anonId, d.ritual_type, calendarId, d.rrule],
              ),
            d.ritual_type,
          );
        } else {
          // User deleted the event at Google — recreate it and re-point the map.
          await doInsert(d, resource);
        }
      } else {
        await doInsert(d, resource);
      }
      written++;
    } catch (err) {
      // One ritual's Google error skips it, not the whole sync; auth errors rethrow.
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
    await safeDbWrite(
      () =>
        db.query(
          `DELETE FROM calendar_event_map WHERE anon_id = $1 AND ritual_type = $2 AND calendar_id = $3`,
          [anonId, e.ritual_type, e.calendar_id],
        ),
      e.ritual_type,
    );
    deleted++;
  }

  return { written, deleted };
}
