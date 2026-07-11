import { beforeEach, describe, expect, it, vi } from 'vitest';

// events.ts imports Queryable (type only) from ../db.js and todayStr from shared.js;
// neither needs a live pool. Mock db.js defensively for any transitive load.
vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

const {
  buildEventResource,
  ensureGgCalendar,
  insertEvent,
  patchEvent,
  deleteEvent,
  listUpcomingEvents,
} = await import('../events.js');

function fetchOnce(res: { ok: boolean; status: number; json?: unknown; text?: string }) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: res.ok,
    status: res.status,
    json: async () => res.json,
    text: async () => res.text ?? '',
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('buildEventResource — DST-correct wall clock', () => {
  it('start.dateTime carries NO offset and timeZone is the IANA id', () => {
    const r = buildEventResource(
      { summary: 'Morning check-in', time: '08:00', rrule: 'RRULE:FREQ=DAILY' },
      'America/New_York',
    );
    const start = r.start as { dateTime: string; timeZone: string };
    expect(start.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T08:00:00$/);
    expect(start.timeZone).toBe('America/New_York');
    expect(r.recurrence).toEqual(['RRULE:FREQ=DAILY']);
  });

  it('end is start + 15 minutes', () => {
    const r = buildEventResource({ summary: 'x', time: '08:00', rrule: 'RRULE:FREQ=DAILY' }, 'UTC');
    const end = r.end as { dateTime: string };
    expect(end.dateTime).toMatch(/T08:15:00$/);
  });

  it('rolls end past midnight onto the next date', () => {
    const r = buildEventResource({ summary: 'x', time: '23:50', rrule: 'RRULE:FREQ=DAILY' }, 'UTC');
    const start = (r.start as { dateTime: string }).dateTime;
    const end = (r.end as { dateTime: string }).dateTime;
    expect(end).toMatch(/T00:05:00$/);
    expect(end.slice(0, 10) > start.slice(0, 10)).toBe(true);
  });

  it('accepts HH:MM:SS times', () => {
    const r = buildEventResource(
      { summary: 'x', time: '21:00:00', rrule: 'RRULE:FREQ=DAILY' },
      'UTC',
    );
    expect((r.start as { dateTime: string }).dateTime).toMatch(/T21:00:00$/);
  });
});

describe('ensureGgCalendar', () => {
  it('POSTs /calendars and persists gg_calendar_id', async () => {
    fetchOnce({ ok: true, status: 200, json: { id: 'ggcal-123' } });
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const id = await ensureGgCalendar('tok', db, 'anon-1', 'UTC');
    expect(id).toBe('ggcal-123');

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(url).toContain('/calendar/v3/calendars');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      summary: 'Guided Growth',
      timeZone: 'UTC',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual(['anon-1', 'ggcal-123']);
  });
});

describe('insert/patch/delete', () => {
  it('insertEvent POSTs the resource to the calendar events collection', async () => {
    fetchOnce({ ok: true, status: 200, json: { id: 'ev-1' } });
    const id = await insertEvent('tok', 'primary', { summary: 'x' });
    expect(id).toBe('ev-1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/calendars/primary/events');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ summary: 'x' });
  });

  it('patchEvent returns true on success and sends the resource', async () => {
    fetchOnce({ ok: true, status: 200, json: {} });
    const ok = await patchEvent('tok', 'primary', 'ev-9', { summary: 'y' });
    expect(ok).toBe(true);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/calendars/primary/events/ev-9');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ summary: 'y' });
  });

  it('patchEvent returns false when the event is gone (404) so the caller re-inserts', async () => {
    fetchOnce({ ok: false, status: 404, text: 'not found' });
    expect(await patchEvent('tok', 'primary', 'ev-dead', { summary: 'y' })).toBe(false);
  });

  it('patchEvent rethrows non-gone errors (e.g. 401)', async () => {
    fetchOnce({ ok: false, status: 401, text: 'unauth' });
    await expect(patchEvent('tok', 'primary', 'ev-9', {})).rejects.toThrow();
  });

  it('deleteEvent returns true on success or already-gone (404/410)', async () => {
    fetchOnce({ ok: true, status: 204 });
    expect(await deleteEvent('tok', 'primary', 'ev-1')).toBe(true);
    fetchOnce({ ok: false, status: 410, text: 'gone' });
    expect(await deleteEvent('tok', 'primary', 'ev-2')).toBe(true);
  });

  it('deleteEvent returns false on a transient failure (keeps the map row)', async () => {
    fetchOnce({ ok: false, status: 500, text: 'boom' });
    expect(await deleteEvent('tok', 'primary', 'ev-3')).toBe(false);
  });
});

describe('listUpcomingEvents', () => {
  it('bounds today, maps items, formats local time', async () => {
    fetchOnce({
      ok: true,
      status: 200,
      json: {
        items: [
          { summary: 'Standup', start: { dateTime: '2026-07-11T09:30:00Z' } },
          { summary: 'Off-site', start: { date: '2026-07-11' } },
          { start: { dateTime: '2026-07-11T14:00:00Z' } },
        ],
      },
    });
    const events = await listUpcomingEvents('tok', 'UTC');
    expect(events).toEqual([
      { time: '09:30', summary: 'Standup' },
      { time: 'all day', summary: 'Off-site' },
      { time: '14:00', summary: '(busy)' },
    ]);

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('singleEvents=true');
    expect(url).toContain('orderBy=startTime');
    expect(url).toContain('maxResults=10');
    expect(url).toContain('timeMin=');
    expect(url).toContain('timeMax=');
  });

  it('formats event time in a non-UTC zone and bounds the local day', async () => {
    fetchOnce({
      ok: true,
      status: 200,
      json: { items: [{ summary: 'Call', start: { dateTime: '2026-07-11T13:30:00Z' } }] },
    });
    // 13:30Z in America/New_York (EDT, -04:00) = 09:30 local.
    const events = await listUpcomingEvents('tok', 'America/New_York');
    expect(events).toEqual([{ time: '09:30', summary: 'Call' }]);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // timeMin should be a local-midnight UTC instant (…T04:00 or T05:00), never T00:00Z.
    const timeMin = decodeURIComponent(url.match(/timeMin=([^&]+)/)![1]);
    expect(timeMin).not.toContain('T00:00:00');
  });

  it('caches within TTL by anonId (one fetch on repeat)', async () => {
    fetchOnce({ ok: true, status: 200, json: { items: [] } });
    const a = await listUpcomingEvents('tok', 'UTC', 'anon-cache');
    const b = await listUpcomingEvents('tok', 'UTC', 'anon-cache');
    expect(a).toEqual(b);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
