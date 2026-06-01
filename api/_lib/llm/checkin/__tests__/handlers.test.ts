import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
};

const { createHabit } = await import('../handlers/createHabit.js');
const { completeHabit } = await import('../handlers/completeHabit.js');
const { updateHabit } = await import('../handlers/updateHabit.js');
const { deleteHabit } = await import('../handlers/deleteHabit.js');
const { createMetric } = await import('../handlers/createMetric.js');
const { logMetric } = await import('../handlers/logMetric.js');
const { deleteMetric } = await import('../handlers/deleteMetric.js');
const { recordCheckin } = await import('../handlers/recordCheckin.js');
const { startFocus } = await import('../handlers/startFocus.js');
const { queryHabits } = await import('../handlers/queryHabits.js');
const { getSummary } = await import('../handlers/getSummary.js');
const { suggestHabit } = await import('../handlers/suggestHabit.js');
const { todayStr, HABIT_SUGGESTIONS, DEFAULT_SUGGESTION } = await import('../handlers/shared.js');

const CTX = { anon_id: '11111111-1111-4111-8111-111111111111' };

// Last query call whose SQL matches `re` — for asserting scoping/params.
function lastCall(re: RegExp): [string, unknown[]] {
  const hit = [...pool.query.mock.calls].reverse().find((c) => re.test(c[0] as string));
  if (!hit) throw new Error(`no query matched ${re}`);
  return hit as [string, unknown[]];
}

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

  it('completes every date in a dates[] array', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
      [/INSERT INTO habit_completions/, { rows: [] }],
    ]);
    const r = await completeHabit(CTX, { name: 'pushups', dates: ['2020-01-01', '2020-01-02'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.dates).toEqual(['2020-01-01', '2020-01-02']);
    const inserts = pool.query.mock.calls.filter((c) =>
      /INSERT INTO habit_completions/.test(c[0] as string),
    );
    expect(inserts.length).toBe(2);
    expect(inserts[0][1]).toEqual([CTX.anon_id, 'h1', '2020-01-01']);
  });

  it('rejects an unrecognized date string', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
    ]);
    const r = await completeHabit(CTX, { name: 'pushups', date: 'someday' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
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
    // COALESCE-preserves prior dims; anon_id scoped to $1.
    const [sql, params] = lastCall(/INSERT INTO daily_checkins/);
    expect(sql).toMatch(/COALESCE\(EXCLUDED\.sleep, daily_checkins\.sleep\)/);
    expect(sql).toMatch(/COALESCE\(EXCLUDED\.stress, daily_checkins\.stress\)/);
    expect(params[0]).toBe(CTX.anon_id);
    // omitted dims passed as null so COALESCE keeps the stored value
    expect(params[4]).toBeNull(); // energy
    expect(params[5]).toBeNull(); // stress
  });

  it('preserves earlier dimensions when a later partial check-in omits them', async () => {
    // Server returns the merged row (energy/stress survived from a prior check-in).
    route([
      [/INSERT INTO daily_checkins/, { rows: [{ sleep: 4, mood: 3, energy: 2, stress: 5 }] }],
    ]);
    const r = await recordCheckin(CTX, { mood: 3 });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.result.checkin).toEqual({ sleep: 4, mood: 3, energy: 2, stress: 5 });
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

  it('honors an explicit valid date', async () => {
    route([
      [/FROM metrics[\s\S]*ILIKE/, { rows: [{ id: 'm1', name: 'weight', input_type: 'numeric' }] }],
      [/INSERT INTO metric_entries/, { rows: [] }],
    ]);
    const r = await logMetric(CTX, { name: 'weight', value: '70', date: '2020-01-01' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toMatchObject({ date: '2020-01-01' });
    const [, params] = lastCall(/INSERT INTO metric_entries/);
    expect(params[3]).toBe('2020-01-01');
  });

  it('rejects an empty value before touching the db', async () => {
    const r = await logMetric(CTX, { name: 'weight', value: '  ' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized date string', async () => {
    route([
      [/FROM metrics[\s\S]*ILIKE/, { rows: [{ id: 'm1', name: 'weight', input_type: 'numeric' }] }],
    ]);
    const r = await logMetric(CTX, { name: 'weight', value: '70', date: 'someday' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });
});

describe('delete_habit', () => {
  it('not_found when absent', async () => {
    route([[/FROM user_habits[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await deleteHabit(CTX, { name: 'ghost' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('archives (soft-delete) scoped to the caller anon_id', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
    ]);
    const r = await deleteHabit(CTX, { name: 'pushups' });
    expect(r.ok).toBe(true);
    const [sql, params] = lastCall(/UPDATE user_habits SET is_active = false/);
    expect(sql).toMatch(/WHERE id = \$1 AND anon_id = \$2/);
    expect(params).toEqual(['h1', CTX.anon_id]);
  });
});

describe('update_habit', () => {
  it('rejects when neither new_name nor frequency is given', async () => {
    const r = await updateHabit(CTX, { name: 'pushups' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an unknown frequency enum without touching the db', async () => {
    const r = await updateHabit(CTX, { name: 'pushups', frequency: 'hourly' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('not_found when the habit is absent', async () => {
    route([[/FROM user_habits[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await updateHabit(CTX, { name: 'ghost', new_name: 'x' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('updates name/frequency scoped to anon_id', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
      [
        /UPDATE user_habits/,
        { rows: [{ id: 'h1', name: 'pull ups', cadence: 'weekdays', schedule_days: null }] },
      ],
    ]);
    const r = await updateHabit(CTX, { name: 'pushups', new_name: 'pull ups', frequency: 'weekdays' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.habit).toMatchObject({ name: 'pull ups', frequency: 'weekdays' });
    const [sql, params] = lastCall(/UPDATE user_habits/);
    expect(sql).toMatch(/WHERE id = \$1 AND anon_id = \$2/);
    expect(params[0]).toBe('h1');
    expect(params[1]).toBe(CTX.anon_id);
  });
});

describe('create_metric', () => {
  it('rejects missing name without touching the db', async () => {
    const r = await createMetric(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an unknown input_type', async () => {
    const r = await createMetric(CTX, { name: 'weight', input_type: 'bogus' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects a duplicate name (pre-insert check)', async () => {
    route([[/FROM metrics[\s\S]*ILIKE/, { rows: [{ id: 'm1', name: 'Weight', input_type: 'numeric' }] }]]);
    const r = await createMetric(CTX, { name: 'weight' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('inserts scoped to anon_id and returns the metric', async () => {
    route([
      [/FROM metrics[\s\S]*ILIKE/, { rows: [] }],
      [
        /INSERT INTO metrics/,
        { rows: [{ id: 'm1', name: 'weight', input_type: 'scale', scale_min: 1, scale_max: 5 }] },
      ],
    ]);
    const r = await createMetric(CTX, { name: 'weight', scale_min: 1, scale_max: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.metric).toMatchObject({ name: 'weight', input_type: 'scale' });
    const [, params] = lastCall(/INSERT INTO metrics/);
    expect(params[0]).toBe(CTX.anon_id);
  });

  it('maps a UNIQUE-violation race to invalid_args', async () => {
    pool.query.mockImplementation(async (sql: string) => {
      if (/FROM metrics[\s\S]*ILIKE/.test(sql)) return { rowCount: 0, rows: [] };
      if (/INSERT INTO metrics/.test(sql)) throw Object.assign(new Error('dup'), { code: '23505' });
      return { rowCount: 0, rows: [] };
    });
    const r = await createMetric(CTX, { name: 'weight' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('returns the cached result on dedup hit without querying', async () => {
    const cached = { ok: true as const, result: { created: true, metric: { id: 'm1' } } };
    const ctx = {
      anon_id: CTX.anon_id,
      tool_call_id: 'tc-1',
      dedupLookup: async () => cached,
    };
    const r = await createMetric(ctx, { name: 'weight' });
    expect(r).toBe(cached);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('delete_metric', () => {
  it('not_found when absent', async () => {
    route([[/FROM metrics[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await deleteMetric(CTX, { name: 'ghost' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('hard-deletes scoped to anon_id', async () => {
    route([[/FROM metrics[\s\S]*ILIKE/, { rows: [{ id: 'm1', name: 'weight', input_type: 'numeric' }] }]]);
    const r = await deleteMetric(CTX, { name: 'weight' });
    expect(r.ok).toBe(true);
    const [sql, params] = lastCall(/DELETE FROM metrics/);
    expect(sql).toMatch(/WHERE id = \$1 AND anon_id = \$2/);
    expect(params).toEqual(['m1', CTX.anon_id]);
  });
});

describe('start_focus', () => {
  it('defaults to a 25-minute session', async () => {
    route([
      [/INSERT INTO focus_sessions/, { rows: [{ id: 'f1', duration_minutes: 25, started_at: 't' }] }],
    ]);
    const r = await startFocus(CTX, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.focus).toMatchObject({ duration_minutes: 25, habit: null });
    const [, params] = lastCall(/INSERT INTO focus_sessions/);
    expect(params[0]).toBe(CTX.anon_id);
  });

  it('rejects an out-of-range duration without touching the db', async () => {
    const r = await startFocus(CTX, { duration: 9999 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('not_found when the named habit is absent', async () => {
    route([[/FROM user_habits[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await startFocus(CTX, { habit: 'ghost' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('returns the cached result on dedup hit without querying', async () => {
    const cached = { ok: true as const, result: { started: true } };
    const ctx = { anon_id: CTX.anon_id, tool_call_id: 'tc-1', dedupLookup: async () => cached };
    const r = await startFocus(ctx, {});
    expect(r).toBe(cached);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('query_habits', () => {
  it('lists all active habits scoped to anon_id', async () => {
    route([
      [
        /SELECT name, cadence FROM user_habits/,
        { rowCount: 2, rows: [{ name: 'pushups', cadence: 'daily' }, { name: 'reading', cadence: 'weekdays' }] },
      ],
    ]);
    const r = await queryHabits(CTX, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.count).toBe(2);
      expect((r.result.habits as unknown[]).length).toBe(2);
    }
    const [, params] = lastCall(/SELECT name, cadence FROM user_habits/);
    expect(params[0]).toBe(CTX.anon_id);
  });

  it('returns stats for a single named habit scoped to habit_id + anon_id', async () => {
    route([
      [
        /FROM user_habits[\s\S]*ILIKE/,
        { rows: [{ id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null }] },
      ],
      [/FROM habit_completions/, { rows: [{ completed_today: true, last_30: 12 }] }],
    ]);
    const r = await queryHabits(CTX, { name: 'pushups' });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.result.habit).toMatchObject({ completed_today: true, completions_last_30_days: 12 });
    const [sql, params] = lastCall(/FROM habit_completions/);
    expect(sql).toMatch(/WHERE habit_id = \$1 AND anon_id = \$2/);
    expect(params[0]).toBe('h1');
    expect(params[1]).toBe(CTX.anon_id);
  });

  it('not_found when the named habit is absent', async () => {
    route([[/FROM user_habits[\s\S]*ILIKE/, { rows: [] }]]);
    const r = await queryHabits(CTX, { name: 'ghost' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('get_summary', () => {
  it('returns 7-day counts scoped to anon_id', async () => {
    route([
      [
        /active_habits/,
        { rows: [{ active_habits: 3, completions: 9, checkins: 5, journals: 2 }] },
      ],
    ]);
    const r = await getSummary(CTX);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.result).toMatchObject({
        period_days: 7,
        active_habits: 3,
        habit_completions: 9,
        checkins: 5,
        journal_entries: 2,
      });
    const [, params] = lastCall(/active_habits/);
    expect(params[0]).toBe(CTX.anon_id);
  });

  it('falls back to zeros when no row is returned', async () => {
    route([[/active_habits/, { rowCount: 0, rows: [] }]]);
    const r = await getSummary(CTX);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.result).toMatchObject({ active_habits: 0, habit_completions: 0, checkins: 0 });
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

  it('returns the default suggestion when the user already has every suggestion', async () => {
    route([
      [/SELECT name FROM user_habits/, { rows: HABIT_SUGGESTIONS.map((name: string) => ({ name })) }],
    ]);
    const r = await suggestHabit(CTX, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.suggestion).toBe(DEFAULT_SUGGESTION);
  });
});

// The future-date guard is evaluated in the caller's tz, not server UTC: the
// same calendar date is "future" west of UTC but "today" east of it.
describe('future-date guard is timezone-relative', () => {
  const habitRow = { id: 'h1', name: 'pushups', cadence: 'daily', schedule_days: null };
  afterEach(() => vi.useRealTimers());

  it('allows the local day east of UTC (Jakarta) while rejecting it west (LA)', async () => {
    // 04:30 UTC → Jakarta (UTC+7) is 2026-06-02; Los Angeles (UTC-7) is still 2026-06-01.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T04:30:00Z'));

    route([
      [/FROM user_habits[\s\S]*ILIKE/, { rows: [habitRow] }],
      [/INSERT INTO habit_completions/, { rows: [] }],
    ]);
    const jakarta = await completeHabit(
      { anon_id: CTX.anon_id, timezone: 'Asia/Jakarta' },
      { name: 'pushups', date: '2026-06-02' },
    );
    expect(jakarta.ok).toBe(true);
    if (jakarta.ok) expect(jakarta.result.dates).toEqual(['2026-06-02']);

    const la = await completeHabit(
      { anon_id: CTX.anon_id, timezone: 'America/Los_Angeles' },
      { name: 'pushups', date: '2026-06-02' },
    );
    expect(la).toMatchObject({ ok: false, error: 'invalid_args' });
  });
});
