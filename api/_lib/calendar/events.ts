import {
  calendarFetch,
  CalendarApiError,
  CalendarDisabledError,
  CalendarNotConnectedError,
  CalendarReauthRequiredError,
  getValidAccessToken,
} from './google.js';
import { todayStr } from '../llm/checkin/handlers/shared.js';
import type { Queryable } from '../db.js';

function isGone(e: unknown): boolean {
  return e instanceof CalendarApiError && (e.status === 404 || e.status === 410);
}

// Google Calendar event helpers over calendarFetch. Events are written with
// wall-clock dateTime + IANA timeZone (NO offset) so Google anchors the local
// time across DST; list bounds use real UTC instants.

const GG_CALENDAR_SUMMARY = 'Guided Growth';
const DEFAULT_DURATION_MIN = 15;

export interface RitualEvent {
  summary: string;
  time: string; // 'HH:MM' or 'HH:MM:SS'
  rrule: string;
  days?: number[] | null; // 0=Sun..6=Sat; null/empty = daily
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// First date >= today whose tz-local weekday is in `days` — keeps a weekly
// DTSTART on-pattern so Google adds no phantom first occurrence.
function firstOnOrAfterToday(tz: string, days?: number[] | null): string {
  const today = todayStr(tz);
  const set = new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (set.size === 0 || set.size >= 7) return today;
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(
    new Date(),
  );
  const todayDow = WEEKDAY[wd] ?? 0;
  const [y, m, d] = today.split('-').map(Number);
  for (let off = 0; off < 7; off++) {
    if (set.has((todayDow + off) % 7)) {
      return new Date(Date.UTC(y, m - 1, d + off)).toISOString().slice(0, 10);
    }
  }
  return today;
}

interface GEvent {
  id: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalizeTime(time: string): { h: number; m: number; s: number } {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
  return { h, m, s };
}

// Wall-clock add — advances the date string across midnight if needed.
function addMinutesWallClock(
  dateStr: string,
  time: string,
  minutes: number,
): { date: string; time: string } {
  const { h, m, s } = normalizeTime(time);
  let total = h * 60 + m + minutes;
  const dayOffset = Math.floor(total / (24 * 60));
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return {
    date: base.toISOString().slice(0, 10),
    time: `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}:${pad2(s)}`,
  };
}

export function buildEventResource(ritual: RitualEvent, tz: string): Record<string, unknown> {
  const date = firstOnOrAfterToday(tz, ritual.days);
  const { h, m, s } = normalizeTime(ritual.time);
  const startTime = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  const end = addMinutesWallClock(date, startTime, DEFAULT_DURATION_MIN);
  return {
    summary: ritual.summary,
    start: { dateTime: `${date}T${startTime}`, timeZone: tz },
    end: { dateTime: `${end.date}T${end.time}`, timeZone: tz },
    recurrence: [ritual.rrule],
    reminders: { useDefault: true },
  };
}

// Reuse an existing app-created "Guided Growth" calendar so reconnects don't
// pile up duplicates. Null if none / listing fails (caller then creates one).
async function findExistingGgCalendar(accessToken: string): Promise<string | null> {
  try {
    const res = await calendarFetch<{
      items?: { id: string; summary?: string; accessRole?: string }[];
    }>(accessToken, '/users/me/calendarList');
    const match = (res.items ?? []).find(
      (c) => c.summary === GG_CALENDAR_SUMMARY && c.accessRole === 'owner',
    );
    return match?.id ?? null;
  } catch (e) {
    // 403 here = our scopes can't list calendars → reuse is a no-op (we create).
    console.warn('[calendar/events] calendarList lookup failed (reuse skipped)', e);
    return null;
  }
}

export async function ensureGgCalendar(
  accessToken: string,
  db: Queryable,
  anonId: string,
  tz: string,
): Promise<string> {
  // Reuse before create — otherwise every fresh connection spawns a new calendar.
  const existing = await findExistingGgCalendar(accessToken);
  let calId = existing;
  if (!calId) {
    const created = await calendarFetch<GEvent>(accessToken, '/calendars', {
      method: 'POST',
      body: JSON.stringify({ summary: GG_CALENDAR_SUMMARY, timeZone: tz }),
    });
    calId = created.id;
  }
  // Claim only if unset — a concurrent sync may have won; then use its id.
  const upd = await db.query(
    `UPDATE calendar_connections SET gg_calendar_id = $2, updated_at = now()
      WHERE anon_id = $1 AND gg_calendar_id IS NULL
      RETURNING gg_calendar_id`,
    [anonId, calId],
  );
  if (upd.rows.length > 0) return calId;
  const cur = await db.query(`SELECT gg_calendar_id FROM calendar_connections WHERE anon_id = $1`, [
    anonId,
  ]);
  const winner = (cur.rows[0] as { gg_calendar_id?: string } | undefined)?.gg_calendar_id ?? calId;
  // Lost the claim AND we created a fresh calendar → delete our orphan.
  if (!existing && winner !== calId) await deleteCalendar(accessToken, calId).catch(() => {});
  return winner;
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  resource: Record<string, unknown>,
): Promise<string> {
  const ev = await calendarFetch<GEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(resource) },
  );
  return ev.id;
}

// false = the event is gone at Google (user deleted it) → caller re-inserts.
// Other errors (auth, 5xx) rethrow so the caller can decide.
export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  resource: Record<string, unknown>,
): Promise<boolean> {
  try {
    await calendarFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'PATCH', body: JSON.stringify(resource) },
    );
    return true;
  } catch (e) {
    if (isGone(e)) return false;
    throw e;
  }
}

// true = deleted or already gone (safe to drop the map row); false = a real
// failure (transient/5xx) → caller keeps the map row so a later sync retries.
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  try {
    await calendarFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    );
    return true;
  } catch (e) {
    if (isGone(e)) return true;
    console.warn('[calendar/events] delete failed (best-effort, will retry)', e);
    return false;
  }
}

// Best-effort delete of a whole calendar — the app-created "Guided Growth" shell.
export async function deleteCalendar(accessToken: string, calendarId: string): Promise<boolean> {
  try {
    await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}`, {
      method: 'DELETE',
    });
    return true;
  } catch (e) {
    if (isGone(e)) return true;
    console.warn('[calendar/events] calendar delete failed (best-effort)', e);
    return false;
  }
}

export interface UpcomingEvent {
  time: string; // 'HH:MM' local, or 'all day'
  summary: string;
}

interface GListItem {
  summary?: string;
  start?: { dateTime?: string; date?: string };
}

// Titles are attacker-controlled (invites auto-add to primary) and reach the
// system prompt — strip newlines/markdown markers, cap length.
function sanitizeSummary(raw: string | undefined): string {
  const s = (raw ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[#>\-*]+\s*/, '')
    .slice(0, 80)
    .trim();
  return s || '(busy)';
}

// tz offset (minutes) for an instant — used to bound "today" in the user's zone.
function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - at.getTime()) / 60000;
}

// UTC instant of local midnight `dayOffset` days from today in tz.
function localMidnightUtc(tz: string, dayOffset: number): Date {
  const [y, m, d] = todayStr(tz).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0);
  const offset = tzOffsetMinutes(tz, new Date(guess));
  return new Date(guess - offset * 60000);
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const cache = new Map<string, { events: UpcomingEvent[]; at: number }>();

// Today's events on the user's PRIMARY calendar. Short-TTL warm-instance cache
// (serverless cold start resets it — read-only context, never a correctness risk).
export async function listUpcomingEvents(
  accessToken: string,
  tz: string,
  anonId?: string,
): Promise<UpcomingEvent[]> {
  if (anonId) {
    const hit = cache.get(anonId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.events;
  }

  // Real local-day bounds (DST-safe — tomorrow's local midnight, not +24h).
  const timeMin = localMidnightUtc(tz, 0);
  const timeMax = localMidnightUtc(tz, 1);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '10',
  });

  const res = await calendarFetch<{ items?: GListItem[] }>(
    accessToken,
    `/calendars/primary/events?${params.toString()}`,
  );

  const events: UpcomingEvent[] = (res.items ?? []).map((item) => ({
    time: item.start?.dateTime
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(item.start.dateTime))
      : 'all day',
    summary: sanitizeSummary(item.summary),
  }));

  if (anonId) {
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(anonId, { events, at: Date.now() });
  }
  return events;
}

export interface UpcomingDisplayEvent {
  start: string; // ISO datetime (timed) or 'YYYY-MM-DD' (all-day)
  allDay: boolean;
  summary: string;
}

// Client-facing read (NOT the LLM path): next `days` days from PRIMARY, no cache.
// Returns raw ISO starts + sanitized summaries; the client formats for its locale.
export async function listUpcomingForDisplay(
  accessToken: string,
  tz: string,
  days = 7,
): Promise<UpcomingDisplayEvent[]> {
  const params = new URLSearchParams({
    timeMin: localMidnightUtc(tz, 0).toISOString(),
    timeMax: localMidnightUtc(tz, days).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  });
  const res = await calendarFetch<{ items?: GListItem[] }>(
    accessToken,
    `/calendars/primary/events?${params.toString()}`,
  );
  return (res.items ?? []).map((item) =>
    item.start?.dateTime
      ? { start: item.start.dateTime, allDay: false, summary: sanitizeSummary(item.summary) }
      : { start: item.start?.date ?? '', allDay: true, summary: sanitizeSummary(item.summary) },
  );
}

// Bound a promise so a hung Google call can't stall a caller (e.g. the LLM turn).
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

// Short negative cache so non-connected users (the majority) don't pay a
// calendar_connections lookup on every gated LLM turn.
const NOT_CONNECTED_TTL_MS = 2 * 60_000;
const READ_BUDGET_MS = 1000; // off the LLM latency-critical path
const notConnectedUntil = new Map<string, number>();

// Drop cached state on connect so a freshly-connected user isn't stale.
export function clearEventCaches(anonId: string): void {
  notConnectedUntil.delete(anonId);
  cache.delete(anonId);
}

// Read-for-context entry point: today's events or [] on any non-happy path
// (not connected / disabled / reauth / outage / timeout). Never throws.
export async function readTodaysEvents(anonId: string, tz: string): Promise<UpcomingEvent[]> {
  const skip = notConnectedUntil.get(anonId);
  if (skip && skip > Date.now()) return [];
  try {
    return await withTimeout(
      (async () => {
        const token = await getValidAccessToken(anonId);
        return listUpcomingEvents(token, tz, anonId);
      })(),
      READ_BUDGET_MS,
      [],
    );
  } catch (err) {
    if (err instanceof CalendarNotConnectedError) {
      if (notConnectedUntil.size >= CACHE_MAX) notConnectedUntil.clear();
      notConnectedUntil.set(anonId, Date.now() + NOT_CONNECTED_TTL_MS);
      return [];
    }
    if (err instanceof CalendarDisabledError || err instanceof CalendarReauthRequiredError) {
      return [];
    }
    console.warn('[calendar/events] readTodaysEvents failed', err);
    return [];
  }
}
