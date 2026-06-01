import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
};

const { createHabit } = await import('../handlers/createHabit.js');
const { completeHabit } = await import('../handlers/completeHabit.js');
const { deleteHabit } = await import('../handlers/deleteHabit.js');
const { logMetric } = await import('../handlers/logMetric.js');
const { recordCheckin } = await import('../handlers/recordCheckin.js');
const { suggestHabit } = await import('../handlers/suggestHabit.js');
const { todayStr } = await import('../handlers/shared.js');

const CTX = { anon_id: '11111111-1111-4111-8111-111111111111' };

type Row = Record<string, unknown>;
function route(routes: Array<[RegExp, { rowCount?: number; rows: Row[] }]>) {
  pool.query.mockImplementation(async (sql: string) => {
    for (const [re, res] of routes) {
      if (re.test(sql)) return { rowCount: res.rowCount ?? res.rows.length, rows: res.rows };
    }
    return { rowCount: 0, rows: [] };
  });
}

beforeEach(() => vi.clearAllMocks());

describe('create_habit', () => {
  it('rejects missing name without touching the db', async () => {
    const r = await createHabit(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'Pushups', cadence: 'daily', schedule_days: null }] },
      ],
    ]);
    const r = await createHabit(CTX, { name: 'pushups' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('creates and returns a 7-day boolean week', async () => {
    route([
      [/FROM user_habits[\s\S]*ILIKE/, { rows: [] }],
      [
        /INSERT INTO user_habits/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
    ]);
    const r = await createHabit(CTX, { name: 'pushups' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.habit).toMatchObject({ name: 'pushups', frequency: 'daily' });
      expect((r.result.habit as { days: boolean[] }).days).toEqual([
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      ]);
    }
  });

  it('rejects an unknown frequency enum', async () => {
    const r = await createHabit(CTX, { name: 'x', frequency: 'hourly' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });
});

describe('complete_habit', () => {
  it('not_found when the habit is absent', async () => {
    route([[/FROM user_habits[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await completeHabit(CTX, { name: 'ghost' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('rejects a future date', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
    ]);
    const r = await completeHabit(CTX, { name: 'pushups', date: '2999-01-01' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('marks today by default', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
      [/INSERT INTO habit_completions/, { rows: [] }],
    ]);
    const r = await completeHabit(CTX, { name: 'pushups' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.dates).toEqual([todayStr()]);
  });
});

describe('record_checkin', () => {
  it('rejects when no dimension is provided', async () => {
    const r = await recordCheckin(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range value', async () => {
    const r = await recordCheckin(CTX, { sleep: 9 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('upserts when at least one dimension is given (coerces string numbers)', async () => {
    route([
      [/INSERT INTO daily_checkins/, { rows: [{ sleep: 4, mood: 3, energy: null, stress: null }] }],
    ]);
    const r = await recordCheckin(CTX, { sleep: '4', mood: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.checkin).toMatchObject({ sleep: 4, mood: 3 });
  });
});

describe('log_metric', () => {
  it('not_found when the metric is absent', async () => {
    route([[/FROM metrics[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await logMetric(CTX, { name: 'weight', value: '70' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('logs against an existing metric', async () => {
    route([
      [/FROM metrics[\s\S]*ILIKE/, { rows: [{ id: 'm1', name: 'weight', input_type: 'numeric' }] }],
      [/INSERT INTO metric_entries/, { rows: [] }],
    ]);
    const r = await logMetric(CTX, { name: 'weight', value: 70 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toMatchObject({ logged: true, value: '70' });
  });
});

describe('delete_habit', () => {
  it('not_found when absent', async () => {
    route([[/FROM user_habits[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await deleteHabit(CTX, { name: 'ghost' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('suggest_habit', () => {
  it('returns a suggestion the user does not already have', async () => {
    route([[/SELECT name FROM user_habits/, { rows: [{ name: 'reading' }] }]]);
    const r = await suggestHabit(CTX, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(typeof r.result.suggestion).toBe('string');
      expect(r.result.suggestion).not.toBe('reading');
    }
  });
});
