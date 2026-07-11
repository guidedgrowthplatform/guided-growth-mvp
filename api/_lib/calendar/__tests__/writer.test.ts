import { beforeEach, describe, expect, it, vi } from 'vitest';

// runSync + readReflectionSettings both use the default pool — mock it once.
vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

import pool from '../../db.js';
const { runSync } = await import('../writer.js');
const { CalendarDisabledError } = await import('../google.js');

const query = pool.query as unknown as ReturnType<typeof vi.fn>;

const tokenRow = () => ({
  access_token: 'valid-token',
  refresh_token: 'r',
  token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  enabled: true,
});
const reflectionRow = (over: Record<string, unknown> = {}) => ({
  mode: 'prompts',
  prompts: [],
  reminder_time: '20:00',
  schedule_days: [],
  reminder_enabled: true,
  schedule_label: null,
  weekly_day: 0,
  ...over,
});
const prefsRow = { morning_time: '08:00:00', night_time: '21:00:00', timezone: 'UTC' };

function fetchOnce(res: { ok: boolean; status: number; json?: unknown; text?: string }) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: res.ok,
    status: res.status,
    json: async () => res.json,
    text: async () => res.text ?? '',
  });
}
function insertsOk(n: number) {
  for (let i = 0; i < n; i++) fetchOnce({ ok: true, status: 200, json: { id: `ev-${i}` } });
}
const methods = () =>
  (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[1] as RequestInit).method);
const fetchUrls = () =>
  (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
const sqls = () => query.mock.calls.map((c) => c[0] as string);
// Parsed POST/PATCH bodies keyed by their `summary`.
function bodiesBySummary(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const c of (global.fetch as ReturnType<typeof vi.fn>).mock.calls) {
    const init = c[1] as RequestInit | undefined;
    if (!init?.body) continue;
    const b = JSON.parse(init.body as string);
    if (b?.summary) out[b.summary] = b;
  }
  return out;
}

// Standard read sequence for a target='own' user with weekly configured.
function seedOwnReads(
  over: { existing?: unknown[]; habits?: unknown[]; weeklyDay?: number | null } = {},
) {
  query.mockResolvedValue({ rows: [] }); // default for writes
  query
    .mockResolvedValueOnce({ rows: [tokenRow()] }) // getValidAccessToken
    .mockResolvedValueOnce({ rows: [{ target: 'own', gg_calendar_id: null }] }) // conn
    .mockResolvedValueOnce({ rows: [prefsRow] }) // prefs
    .mockResolvedValueOnce({ rows: [reflectionRow()] }) // readReflectionSettings
    .mockResolvedValueOnce({
      rows: [{ weekly_day: over.weeklyDay === undefined ? 0 : over.weeklyDay }],
    }) // raw weekly_day
    .mockResolvedValueOnce({ rows: over.habits ?? [] }) // habits
    .mockResolvedValueOnce({ rows: over.existing ?? [] }); // event_map
}

beforeEach(() => {
  vi.restoreAllMocks();
  query.mockReset();
  global.fetch = vi.fn();
});

describe('runSync idempotency + payloads', () => {
  it('first run inserts one event per ritual with correct time/RRULE/timeZone', async () => {
    seedOwnReads();
    insertsOk(4);

    const r1 = await runSync('anon-1');

    expect(r1).toEqual({ written: 4, deleted: 0 });
    expect(methods()).toEqual(['POST', 'POST', 'POST', 'POST']);
    expect(sqls().filter((s) => s.includes('INSERT INTO calendar_event_map'))).toHaveLength(4);
    expect(fetchUrls().every((u) => u.includes('/calendars/primary/events'))).toBe(true);

    const b = bodiesBySummary();
    expect(b['Morning check-in'].start).toMatchObject({ timeZone: 'UTC' });
    expect((b['Morning check-in'].start as { dateTime: string }).dateTime).toMatch(/T08:00:00$/);
    expect(b['Morning check-in'].recurrence).toEqual(['RRULE:FREQ=DAILY']);
    expect((b['Evening check-in'].start as { dateTime: string }).dateTime).toMatch(/T21:00:00$/);
    expect((b['Evening reflection'].start as { dateTime: string }).dateTime).toMatch(/T20:00:00$/);
    expect(b['The Weekly'].recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=SU']);
  });

  it('second run only patches — no duplicate inserts', async () => {
    query.mockResolvedValue({ rows: [] });
    query
      .mockResolvedValueOnce({ rows: [tokenRow()] })
      .mockResolvedValueOnce({ rows: [{ target: 'own', gg_calendar_id: null }] })
      .mockResolvedValueOnce({ rows: [prefsRow] })
      .mockResolvedValueOnce({ rows: [reflectionRow()] })
      .mockResolvedValueOnce({ rows: [{ weekly_day: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { ritual_type: 'morning_checkin', calendar_id: 'primary', google_event_id: 'ev-0' },
          { ritual_type: 'evening_checkin', calendar_id: 'primary', google_event_id: 'ev-1' },
          { ritual_type: 'evening_reflection', calendar_id: 'primary', google_event_id: 'ev-2' },
          { ritual_type: 'weekly', calendar_id: 'primary', google_event_id: 'ev-3' },
        ],
      });
    for (let i = 0; i < 4; i++) fetchOnce({ ok: true, status: 200, json: {} });

    const r2 = await runSync('anon-1');

    expect(r2).toEqual({ written: 4, deleted: 0 });
    expect(methods()).toEqual(['PATCH', 'PATCH', 'PATCH', 'PATCH']);
    expect(sqls().some((s) => s.includes('INSERT INTO calendar_event_map'))).toBe(false);
    expect(sqls().filter((s) => s.includes('UPDATE calendar_event_map'))).toHaveLength(4);
  });

  it('re-creates an event the user deleted at Google (patch 404 → insert)', async () => {
    seedOwnReads({
      existing: [
        { ritual_type: 'morning_checkin', calendar_id: 'primary', google_event_id: 'ev-0' },
      ],
    });
    fetchOnce({ ok: false, status: 404, text: 'gone' }); // patch morning → gone
    fetchOnce({ ok: true, status: 200, json: { id: 'ev-new' } }); // re-insert morning
    insertsOk(3); // evening_checkin, reflection, weekly

    const r = await runSync('anon-1');

    expect(r.written).toBe(4);
    expect(methods()[0]).toBe('PATCH');
    expect(methods()[1]).toBe('POST');
    expect(bodiesBySummary()['Morning check-in']).toBeDefined();
  });
});

describe('runSync GG calendar', () => {
  it('creates the Guided Growth calendar on first gg write and writes all 4 rituals there', async () => {
    query.mockResolvedValue({ rows: [] });
    query
      .mockResolvedValueOnce({ rows: [tokenRow()] })
      .mockResolvedValueOnce({ rows: [{ target: 'gg', gg_calendar_id: null }] })
      .mockResolvedValueOnce({ rows: [prefsRow] })
      .mockResolvedValueOnce({ rows: [] }) // ensureGgCalendar UPDATE
      .mockResolvedValueOnce({ rows: [reflectionRow()] })
      .mockResolvedValueOnce({ rows: [{ weekly_day: 0 }] })
      .mockResolvedValueOnce({ rows: [] }) // habits
      .mockResolvedValueOnce({ rows: [] }); // event_map
    fetchOnce({ ok: true, status: 200, json: { id: 'gg-cal-1' } }); // POST /calendars
    insertsOk(4);

    const r = await runSync('anon-1');

    expect(r.written).toBe(4);
    expect(fetchUrls()[0]).toMatch(/\/calendar\/v3\/calendars$/);
    expect(sqls().some((s) => s.includes('gg_calendar_id'))).toBe(true);
    expect(
      fetchUrls()
        .slice(1)
        .every((u) => u.includes('/calendars/gg-cal-1/events')),
    ).toBe(true);
    expect(bodiesBySummary()['Evening reflection']).toBeDefined();
  });

  it('reuses an existing gg_calendar_id (no calendar creation)', async () => {
    query.mockResolvedValue({ rows: [] });
    query
      .mockResolvedValueOnce({ rows: [tokenRow()] })
      .mockResolvedValueOnce({ rows: [{ target: 'gg', gg_calendar_id: 'gg-existing' }] })
      .mockResolvedValueOnce({ rows: [prefsRow] })
      .mockResolvedValueOnce({ rows: [reflectionRow()] })
      .mockResolvedValueOnce({ rows: [{ weekly_day: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    insertsOk(4);

    await runSync('anon-1');

    expect(fetchUrls().some((u) => /\/calendar\/v3\/calendars$/.test(u))).toBe(false);
    expect(fetchUrls().every((u) => u.includes('/calendars/gg-existing/events'))).toBe(true);
  });
});

describe('runSync reap', () => {
  it('deletes an event whose ritual is no longer desired', async () => {
    seedOwnReads({
      existing: [
        { ritual_type: 'morning_checkin', calendar_id: 'primary', google_event_id: 'ev-0' },
        { ritual_type: 'evening_checkin', calendar_id: 'primary', google_event_id: 'ev-1' },
        { ritual_type: 'evening_reflection', calendar_id: 'primary', google_event_id: 'ev-2' },
        { ritual_type: 'weekly', calendar_id: 'primary', google_event_id: 'ev-3' },
        { ritual_type: 'habit:gone', calendar_id: 'primary', google_event_id: 'ev-gone' },
      ],
    });
    for (let i = 0; i < 4; i++) fetchOnce({ ok: true, status: 200, json: {} }); // patches
    fetchOnce({ ok: true, status: 204 }); // the reap DELETE

    const r = await runSync('anon-1');

    expect(r.deleted).toBe(1);
    const delIdx = methods().findIndex((m) => m === 'DELETE');
    expect(fetchUrls()[delIdx]).toContain('/events/ev-gone');
    expect(sqls().some((s) => s.includes('DELETE FROM calendar_event_map'))).toBe(true);
  });

  it('keeps the map row when the reap delete transiently fails', async () => {
    seedOwnReads({
      existing: [{ ritual_type: 'habit:gone', calendar_id: 'primary', google_event_id: 'ev-x' }],
    });
    insertsOk(4); // the 4 desired rituals
    fetchOnce({ ok: false, status: 500, text: 'boom' }); // reap DELETE fails hard

    const r = await runSync('anon-1');

    expect(r.deleted).toBe(0);
    expect(sqls().some((s) => s.includes('DELETE FROM calendar_event_map'))).toBe(false);
  });

  it('moves events to the new calendar on a target switch (own→gg)', async () => {
    query.mockResolvedValue({ rows: [] });
    query
      .mockResolvedValueOnce({ rows: [tokenRow()] })
      .mockResolvedValueOnce({ rows: [{ target: 'gg', gg_calendar_id: 'gg-cal' }] })
      .mockResolvedValueOnce({ rows: [prefsRow] })
      .mockResolvedValueOnce({ rows: [reflectionRow()] })
      .mockResolvedValueOnce({ rows: [{ weekly_day: 0 }] })
      .mockResolvedValueOnce({ rows: [] }) // habits
      .mockResolvedValueOnce({
        rows: [
          { ritual_type: 'morning_checkin', calendar_id: 'primary', google_event_id: 'ev-0' },
          { ritual_type: 'evening_checkin', calendar_id: 'primary', google_event_id: 'ev-1' },
          { ritual_type: 'evening_reflection', calendar_id: 'primary', google_event_id: 'ev-2' },
          { ritual_type: 'weekly', calendar_id: 'primary', google_event_id: 'ev-3' },
        ],
      });
    insertsOk(4); // 4 inserts on gg-cal
    for (let i = 0; i < 4; i++) fetchOnce({ ok: true, status: 204 }); // 4 deletes on primary

    const r = await runSync('anon-1');

    expect(r).toEqual({ written: 4, deleted: 4 });
    const inserts = fetchUrls().filter((_, i) => methods()[i] === 'POST');
    const deletes = fetchUrls().filter((_, i) => methods()[i] === 'DELETE');
    expect(inserts.every((u) => u.includes('/calendars/gg-cal/events'))).toBe(true);
    expect(deletes.every((u) => u.includes('/calendars/primary/events/'))).toBe(true);
  });
});

describe('runSync ritual gating', () => {
  it('omits The Weekly when the user never chose a day (weekly_day NULL)', async () => {
    seedOwnReads({ weeklyDay: null });
    insertsOk(3);

    const r = await runSync('anon-1');

    expect(r.written).toBe(3);
    expect(bodiesBySummary()['The Weekly']).toBeUndefined();
    expect(bodiesBySummary()['Morning check-in']).toBeDefined();
  });

  it('builds a weekly RRULE for a habit with schedule_days', async () => {
    seedOwnReads({
      weeklyDay: null, // isolate the habit
      habits: [
        {
          id: 'h1',
          name: 'Run',
          schedule_days: [1, 2, 3, 4, 5],
          reminder_time: '07:00:00',
          reminder_enabled: true,
        },
      ],
    });
    insertsOk(4); // morning, evening_checkin, reflection, habit

    await runSync('anon-1');

    const run = bodiesBySummary()['Run'];
    expect(run).toBeDefined();
    expect(run.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR']);
    expect((run.start as { dateTime: string }).dateTime).toMatch(/T07:00:00$/);
  });

  it('skips habits with reminders disabled', async () => {
    seedOwnReads({
      weeklyDay: null,
      habits: [
        {
          id: 'h1',
          name: 'Run',
          schedule_days: null,
          reminder_time: '07:00:00',
          reminder_enabled: false,
        },
      ],
    });
    insertsOk(3);

    const r = await runSync('anon-1');
    expect(r.written).toBe(3);
    expect(bodiesBySummary()['Run']).toBeUndefined();
  });
});

describe('runSync guards', () => {
  it('rejects with CalendarDisabledError and makes no Google call when disabled', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...tokenRow(), enabled: false }] });

    await expect(runSync('anon-1')).rejects.toBeInstanceOf(CalendarDisabledError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips a concurrent sync for the same user (in-flight guard)', async () => {
    let resolveToken!: (v: unknown) => void;
    query.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveToken = res;
        }),
    );

    const first = runSync('anon-cc'); // acquires the slot, hangs on the token query
    const second = await runSync('anon-cc'); // blocked by the guard
    expect(second).toEqual({ written: 0, deleted: 0, skipped: true });

    resolveToken({ rows: [{ ...tokenRow(), enabled: false }] }); // let first finish (disabled)
    await expect(first).rejects.toBeInstanceOf(CalendarDisabledError);
  });
});
