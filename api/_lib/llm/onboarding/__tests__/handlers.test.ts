import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};

const { MAX_HABITS } = await import('../schemas.js');

// addHabit runs inside pool.connect() — fake client routes by SQL shape.
function habitClient(opts: { hc?: Record<string, unknown> | null; upsert?: unknown }) {
  const query = vi.fn(async (sql: string) => {
    if (/SELECT data->'habitConfigs'/.test(sql)) {
      return { rowCount: 1, rows: [{ hc: opts.hc ?? {} }] };
    }
    if (/INSERT INTO onboarding_states/.test(sql)) {
      return { rowCount: 1, rows: [opts.upsert ?? { data: {}, current_step: 5 }] };
    }
    return { rowCount: 0, rows: [] };
  });
  return { query, release: vi.fn() };
}

const { submitProfile } = await import('../handlers/submitProfile.js');
const { submitPathChoice } = await import('../handlers/submitPathChoice.js');
const { submitCategory } = await import('../handlers/submitCategory.js');
const { submitGoals } = await import('../handlers/submitGoals.js');
const { addHabit } = await import('../handlers/addHabit.js');
const { removeHabit } = await import('../handlers/removeHabit.js');
const { updateHabit } = await import('../handlers/updateHabit.js');
const { submitReflectionConfig } = await import('../handlers/submitReflectionConfig.js');
const { submitBrainDump } = await import('../handlers/submitBrainDump.js');
const { advanceStep } = await import('../handlers/advanceStep.js');
const { confirmPlan } = await import('../handlers/confirmPlan.js');

const CTX = { anon_id: '11111111-1111-4111-8111-111111111111' };

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue({ rowCount: 1, rows: [] });
});

// ─── submit_profile ───────────────────────────────────────────────────

describe('submit_profile', () => {
  it('rejects missing nickname', async () => {
    const r = await submitProfile(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects nickname over 50 chars', async () => {
    const r = await submitProfile(CTX, { nickname: 'a'.repeat(51) });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects nickname with special chars', async () => {
    const r = await submitProfile(CTX, { nickname: 'a-b!' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects non-numeric age', async () => {
    const r = await submitProfile(CTX, { nickname: 'alice', age: 'abc' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects age below 13', async () => {
    const r = await submitProfile(CTX, { nickname: 'alice', age: '12' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects age above 120', async () => {
    const r = await submitProfile(CTX, { nickname: 'alice', age: '121' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects negative age', async () => {
    const r = await submitProfile(CTX, { nickname: 'alice', age: '-5' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts boundary ages 13 and 120', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ data: {}, current_step: 2 }] });
    const lo = await submitProfile(CTX, { nickname: 'a', age: '13' });
    const hi = await submitProfile(CTX, { nickname: 'a', age: '120' });
    expect(lo.ok).toBe(true);
    expect(hi.ok).toBe(true);
  });

  it('rejects gender outside enum', async () => {
    const r = await submitProfile(CTX, { nickname: 'alice', gender: 'unknown' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts nickname-only, seeds step 1, does NOT bump current_step', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { nickname: 'alice' }, current_step: 1 }],
    });
    const r = await submitProfile(CTX, { nickname: 'alice' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toMatchObject({ data: { nickname: 'alice' }, current_step: 1 });
    }
    const [sql, params] = pool.query.mock.calls[0];
    // DATA ONLY: INSERT seeds this screen's own step (1); UPDATE never touches current_step.
    expect(sql).toMatch(/VALUES \(\$1, 1,/);
    expect(sql).not.toMatch(/current_step = GREATEST/);
    expect(sql).toMatch(/data = onboarding_states\.data \|\| \$2::jsonb/);
    expect(sql).toMatch(/RETURNING data, current_step/);
    expect(params[0]).toBe(CTX.anon_id);
    expect(JSON.parse(params[1] as string)).toEqual({ nickname: 'alice' });
  });

  it('accepts all fields and merges camelCase data payload', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          data: { nickname: 'alice', age: 28, gender: 'Female', referralSource: 'Reddit' },
          current_step: 2,
        },
      ],
    });
    const r = await submitProfile(CTX, {
      nickname: 'alice',
      age: '28',
      gender: 'Female',
      referral_source: 'Reddit',
    });
    expect(r.ok).toBe(true);
    const [, params] = pool.query.mock.calls[0];
    expect(JSON.parse(params[1] as string)).toEqual({
      nickname: 'alice',
      age: 28,
      gender: 'Female',
      referralSource: 'Reddit',
    });
  });
});

// ─── submit_path_choice ──────────────────────────────────────────────

describe('submit_path_choice', () => {
  it('rejects missing path', async () => {
    const r = await submitPathChoice(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects path outside enum', async () => {
    const r = await submitPathChoice(CTX, { path: 'other' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts simple, seeds step 2, does NOT bump current_step', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: {}, current_step: 2, path: 'simple' }],
    });
    const r = await submitPathChoice(CTX, { path: 'simple' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toMatchObject({ path: 'simple', current_step: 2 });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/current_step = GREATEST/);
    expect(sql).toMatch(/VALUES \(\$1, 2,/);
  });

  it('accepts braindump', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: {}, current_step: 3, path: 'braindump' }],
    });
    const r = await submitPathChoice(CTX, { path: 'braindump' });
    expect(r.ok).toBe(true);
  });
});

// ─── submit_category ─────────────────────────────────────────────────

describe('submit_category', () => {
  it('rejects missing category', async () => {
    const r = await submitCategory(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects category outside enum', async () => {
    const r = await submitCategory(CTX, { category: 'Sleep more' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts valid category, seeds step 3, does NOT bump current_step', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { category: 'Sleep better' }, current_step: 3 }],
    });
    const r = await submitCategory(CTX, { category: 'Sleep better' });
    expect(r.ok).toBe(true);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/current_step = GREATEST/);
    expect(sql).toMatch(/VALUES \(\$1, 3,/);
  });
});

// ─── submit_goals ────────────────────────────────────────────────────

describe('submit_goals', () => {
  it('rejects non-array goals', async () => {
    const r = await submitGoals(CTX, { goals: 'walk' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects empty array', async () => {
    const r = await submitGoals(CTX, { goals: [] });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts goals when no category set (free-text path)', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ category: null }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { goals: ['anything'] }, current_step: 5 }],
      });
    const r = await submitGoals(CTX, { goals: ['anything'] });
    expect(r.ok).toBe(true);
  });

  it('fuzzy-matches against the category goal list', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ category: 'Move more' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { goals: ['Walk more'] }, current_step: 5 }],
      });
    const r = await submitGoals(CTX, { goals: ['walk more'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.goals).toEqual(['Walk more']);
  });

  it('rejects when nothing matches the category list', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ category: 'Sleep better' }] });
    const r = await submitGoals(CTX, { goals: ['zzzzz qqqq'] });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('caps at MAX_GOALS=2', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ category: 'Sleep better' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            data: { goals: ['Fall asleep earlier', 'Wake up earlier'] },
            current_step: 5,
          },
        ],
      });
    const r = await submitGoals(CTX, {
      goals: ['Fall asleep earlier', 'Wake up earlier', 'Sleep more consistently'],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.result.goals as string[]).length).toBeLessThanOrEqual(2);
  });
});

// ─── add_habit ───────────────────────────────────────────────────────

describe('update_habit', () => {
  const HC = (hc: Record<string, unknown>) => ({
    rowCount: 1,
    rows: [{ hc, current_step: 7 }],
  });

  it('rejects missing name', async () => {
    const r = await updateHabit(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('idempotent ok + no write when the habit is absent', async () => {
    pool.query.mockResolvedValueOnce(HC({ Run: { days: [1], time: '07:00' } }));
    const r = await updateHabit(CTX, { name: 'Walk', time: '08:00' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.updated).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1); // SELECT only, no UPDATE
  });

  it('rejects when no fields are provided to change', async () => {
    pool.query.mockResolvedValueOnce(HC({ Walk: { days: [1], time: '07:00' } }));
    const r = await updateHabit(CTX, { name: 'Walk' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).toHaveBeenCalledTimes(1); // SELECT only
  });

  it('patches only the provided field, preserving the rest (case-insensitive)', async () => {
    pool.query
      .mockResolvedValueOnce(
        HC({
          Meditate: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true, schedule: 'Weekday' },
        }),
      )
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 7 }] });
    const r = await updateHabit(CTX, { name: 'meditate', time: '08:00' });
    expect(r.ok).toBe(true);
    // UPDATE is the 2nd query; $2 carries { [matchKey]: mergedEntry }.
    const merge = JSON.parse(pool.query.mock.calls[1][1][1] as string);
    expect(merge).toEqual({
      Meditate: { days: [1, 2, 3, 4, 5], time: '08:00', reminder: true, schedule: 'Weekday' },
    });
  });

  it('days change re-infers schedule and preserves the untouched time', async () => {
    pool.query
      .mockResolvedValueOnce(
        HC({ Walk: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true, schedule: 'Weekday' } }),
      )
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 7 }] });
    await updateHabit(CTX, { name: 'Walk', days: [0, 6] });
    const merge = JSON.parse(pool.query.mock.calls[1][1][1] as string);
    expect(merge.Walk.days).toEqual([0, 6]);
    expect(merge.Walk.schedule).toBe('Weekend');
    expect(merge.Walk.time).toBe('07:00');
  });

  it('schedule only: expands days from the preset', async () => {
    pool.query
      .mockResolvedValueOnce(
        HC({ Walk: { days: [1, 2, 3, 4, 5], time: '07:00', schedule: 'Weekday' } }),
      )
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 7 }] });
    await updateHabit(CTX, { name: 'Walk', schedule: 'Every day' });
    const merge = JSON.parse(pool.query.mock.calls[1][1][1] as string);
    expect(merge.Walk.schedule).toBe('Every day');
    expect(merge.Walk.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('merge payload carries only the patched habit (sibling habits untouched by ||)', async () => {
    pool.query
      .mockResolvedValueOnce(
        HC({
          Walk: { days: [1], time: '07:00' },
          Read: { days: [2], time: '21:00' },
        }),
      )
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 7 }] });
    await updateHabit(CTX, { name: 'Walk', time: '08:00' });
    const [sql, params] = pool.query.mock.calls[1];
    // jsonb `||` merges the single key, so the payload names only Walk; Read survives in-DB.
    expect(JSON.parse(params[1] as string)).toEqual({ Walk: { days: [1], time: '08:00' } });
    expect(sql).toMatch(/COALESCE\(data->'habitConfigs', '\{\}'::jsonb\) \|\| \$2::jsonb/);
  });
});

describe('add_habit', () => {
  const validHabit = {
    name: 'Walk',
    days: [1, 2, 3, 4, 5],
    time: '09:00',
    reminder: true,
    schedule: 'Weekday',
  };

  it('rejects missing name', async () => {
    const r = await addHabit(CTX, { ...validHabit, name: '' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  // Vapi parity: malformed/omitted fields default rather than rejecting.
  function persistedHabit(client: ReturnType<typeof habitClient>) {
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    return JSON.parse(upsert![1][2] as string).Walk;
  }

  it('name-only call succeeds with all four defaults', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    const r = await addHabit(CTX, { name: 'Walk' });
    expect(r).toMatchObject({ ok: true });
    expect(persistedHabit(client)).toEqual({
      days: [1, 2, 3, 4, 5],
      time: '09:00',
      reminder: true,
      schedule: 'Weekday',
    });
  });

  it('defaults days when out of 0-6 range', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    const r = await addHabit(CTX, { name: 'Walk', days: [7] });
    expect(r).toMatchObject({ ok: true });
    expect(persistedHabit(client).days).toEqual([1, 2, 3, 4, 5]);
  });

  it('defaults time when format is invalid', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, time: '9am' });
    expect(persistedHabit(client).time).toBe('09:00');
  });

  it('defaults reminder when non-boolean', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, reminder: 'yes' });
    expect(persistedHabit(client).reminder).toBe(true);
  });

  it('ignores schedule outside enum, infers from days', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, schedule: 'Daily' });
    expect(persistedHabit(client).schedule).toBe('Weekday');
  });

  // Fixture filled to MAX_HABITS so the cap test tracks the real limit.
  const atCap = Object.fromEntries(
    Array.from({ length: MAX_HABITS }, (_, i) => [`Existing${i}`, {}]),
  );

  it('returns max_habits_reached when at cap with new name', async () => {
    const client = habitClient({ hc: atCap });
    pool.connect.mockResolvedValue(client);
    const r = await addHabit(CTX, { ...validHabit, name: 'NewHabit' });
    expect(r).toEqual({
      ok: false,
      error: 'handler_error',
      message: 'max_habits_reached',
    });
    const sqls = client.query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(false);
    expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
  });

  it('allows edit when at cap (existing name)', async () => {
    const hc = { Walk: {}, ...atCap };
    const client = habitClient({
      hc,
      upsert: { data: { habitConfigs: { Walk: {} } }, current_step: 5 },
    });
    pool.connect.mockResolvedValue(client);
    const r = await addHabit(CTX, { ...validHabit, name: 'Walk' });
    expect(r.ok).toBe(true);
    const sqls = client.query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(true);
  });

  it('treats case-variant name as edit (symmetric with remove_habit)', async () => {
    const client = habitClient({
      hc: { Walk: {}, ...atCap },
      upsert: { data: { habitConfigs: { Walk: {} } }, current_step: 5 },
    });
    pool.connect.mockResolvedValue(client);
    const r = await addHabit(CTX, { ...validHabit, name: 'walk' });
    expect(r.ok).toBe(true);
  });

  it('wraps the write in a txn with advisory lock + commit', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, validHabit);
    const sqls = client.query.mock.calls.map((c) => c[0] as string);
    expect(sqls[0]).toMatch(/BEGIN/);
    expect(sqls.some((s) => /pg_advisory_xact_lock/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);
  });

  it('UPSERT carries jsonb_set merge payload', async () => {
    const client = habitClient({
      hc: {},
      upsert: { data: { habitConfigs: { Walk: {} } }, current_step: 5 },
    });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, validHabit);
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    expect(upsert).toBeDefined();
    const [sql, params] = upsert!;
    expect(sql).toMatch(/jsonb_set/);
    expect(sql).not.toMatch(/current_step = GREATEST/);
    // $3 is the merge sub-payload { [name]: habitEntry }
    expect(JSON.parse(params[2] as string)).toEqual({
      Walk: {
        days: [1, 2, 3, 4, 5],
        time: '09:00',
        reminder: true,
        schedule: 'Weekday',
      },
    });
  });

  it('dedupes + sorts days', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, days: [3, 1, 1, 2] });
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    const merge = JSON.parse(upsert![1][2] as string);
    expect(merge.Walk.days).toEqual([1, 2, 3]);
  });

  // Mint round-2: days is authoritative — when LLM supplies stale schedule
  // label vs days, the schedule field is overwritten so PlanReviewPage's
  // formatCadence(days) is faithful and the persisted shape is self-consistent.
  it('reconciles stale schedule label against days (Every day -> Weekday)', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, days: [1, 2, 3, 4, 5], schedule: 'Every day' });
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    const merge = JSON.parse(upsert![1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekday');
    expect(merge.Walk.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('reconciles stale schedule label against days (Weekday -> Every day)', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, {
      ...validHabit,
      days: [0, 1, 2, 3, 4, 5, 6],
      schedule: 'Weekday',
    });
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    const merge = JSON.parse(upsert![1][2] as string);
    expect(merge.Walk.schedule).toBe('Every day');
  });

  it('keeps the LLM-supplied schedule when days is a custom combination (no preset match)', async () => {
    // Mon/Wed/Fri doesn't match any preset; falling back to the LLM's label
    // is best-effort since there's no "custom" enum value. PlanReviewPage
    // renders "3 days/week" via formatCadence regardless.
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, days: [1, 3, 5], schedule: 'Weekday' });
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    const merge = JSON.parse(upsert![1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekday');
    expect(merge.Walk.days).toEqual([1, 3, 5]);
  });

  it('canonical match: days+schedule already agree (no-op reconcile)', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, days: [1, 2, 3, 4, 5], schedule: 'Weekday' });
    const upsert = client.query.mock.calls.find((c) =>
      /INSERT INTO onboarding_states/.test(c[0] as string),
    );
    const merge = JSON.parse(upsert![1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekday');
    expect(merge.Walk.days).toEqual([1, 2, 3, 4, 5]);
  });
});

// ─── remove_habit ────────────────────────────────────────────────────

describe('remove_habit', () => {
  it('rejects missing name', async () => {
    const r = await removeHabit(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('returns ok when row absent (idempotent)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await removeHabit(CTX, { name: 'Walk' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.removed).toBeNull();
  });

  it('returns ok when key absent (idempotent)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ hc: { Run: {} }, data: { habitConfigs: { Run: {} } }, current_step: 5 }],
    });
    const r = await removeHabit(CTX, { name: 'Walk' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.removed).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1); // no UPDATE issued
  });

  it('case-insensitive match removes the entry', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ hc: { Walk: {} }, data: { habitConfigs: { Walk: {} } }, current_step: 5 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { habitConfigs: {} }, current_step: 5 }],
      });
    const r = await removeHabit(CTX, { name: 'walk' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.removed).toBe('Walk');
    const [sql] = pool.query.mock.calls[1];
    expect(sql).toMatch(
      /jsonb_set\(data, '\{habitConfigs\}', \(data->'habitConfigs'\) - \$2::text\)/,
    );
  });
});

// ─── submit_reflection_config ────────────────────────────────────────

describe('submit_reflection_config', () => {
  const valid = {
    time: '21:45',
    days: [1, 2, 3, 4, 5],
    reminder: true,
    schedule: 'Weekday',
  };

  it('rejects invalid time', async () => {
    const r = await submitReflectionConfig(CTX, { ...valid, time: '99:99' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects days out of range', async () => {
    const r = await submitReflectionConfig(CTX, { ...valid, days: [-1] });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts valid config, seeds step 6, does NOT bump current_step', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { reflectionConfig: valid }, current_step: 6 }],
    });
    const r = await submitReflectionConfig(CTX, valid);
    expect(r.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/current_step = GREATEST/);
    expect(sql).toMatch(/VALUES \(\$1, 6,/);
    expect(JSON.parse(params[1] as string)).toEqual({ reflectionConfig: valid });
  });

  // Mint round-2: days authoritative, schedule reconciled at write time so
  // PlanReviewPage's formatCadence(days) is faithful.
  it('reconciles stale schedule label against days (Every day -> Weekday)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 7 }] });
    await submitReflectionConfig(CTX, { ...valid, days: [1, 2, 3, 4, 5], schedule: 'Every day' });
    const params = pool.query.mock.calls[0][1];
    const payload = JSON.parse(params[1] as string);
    expect(payload.reflectionConfig.schedule).toBe('Weekday');
    expect(payload.reflectionConfig.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the LLM-supplied label when days is a custom combination', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 7 }] });
    await submitReflectionConfig(CTX, { ...valid, days: [1, 3, 5], schedule: 'Weekday' });
    const params = pool.query.mock.calls[0][1];
    const payload = JSON.parse(params[1] as string);
    expect(payload.reflectionConfig.schedule).toBe('Weekday'); // no preset match → keep LLM label
    expect(payload.reflectionConfig.days).toEqual([1, 3, 5]);
  });
});

// ─── submit_brain_dump ───────────────────────────────────────────────

describe('submit_brain_dump', () => {
  it('rejects missing brain_dump_raw', async () => {
    const r = await submitBrainDump(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects under 10 chars', async () => {
    const r = await submitBrainDump(CTX, { brain_dump_raw: 'short' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects whitespace-only that meets raw length', async () => {
    const r = await submitBrainDump(CTX, { brain_dump_raw: '            ' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects over 5000 chars', async () => {
    const r = await submitBrainDump(CTX, { brain_dump_raw: 'x'.repeat(5001) });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('dual-writes data.brainDumpText and brain_dump_raw column', async () => {
    const text = 'I want to sleep better and exercise more regularly.';
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          data: { brainDumpText: text },
          current_step: 3,
          brain_dump_raw: text,
        },
      ],
    });
    const r = await submitBrainDump(CTX, { brain_dump_raw: text });
    expect(r.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/brain_dump_raw = \$3/);
    expect(sql).not.toMatch(/current_step = GREATEST/);
    expect(sql).toMatch(/VALUES \(\$1, 3,/);
    expect(JSON.parse(params[1] as string)).toEqual({ brainDumpText: text });
    expect(params[2]).toBe(text);
  });
});

// ─── advance_step ────────────────────────────────────────────────────

describe('advance_step', () => {
  it('rejects non-integer target_step', async () => {
    const r = await advanceStep(CTX, { target_step: 2.5 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects out-of-range target_step (0 and 11)', async () => {
    const lo = await advanceStep(CTX, { target_step: 0 });
    const hi = await advanceStep(CTX, { target_step: 11 });
    expect(lo).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(hi).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects multi-step skip (current=3, target=5)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          current_step: 3,
          data: { category: 'Sleep better' },
          path: 'simple',
          brain_dump_raw: null,
        },
      ],
    });
    const r = await advanceStep(CTX, { target_step: 5 });
    expect(r).toMatchObject({ ok: false, error: 'handler_error' });
    if (!r.ok) expect(r.message).toMatch(/cannot_skip_steps/);
  });

  it('rejects forward advance when source data missing (current=3, category absent, target=4)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ current_step: 3, data: {}, path: 'simple', brain_dump_raw: null }],
    });
    const r = await advanceStep(CTX, { target_step: 4 });
    expect(r).toMatchObject({ ok: false, error: 'handler_error' });
    if (!r.ok) expect(r.message).toMatch(/category_or_braindump_missing/);
  });

  it('success: current=3 with category set, target=4 → bare current_step set', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 3,
            data: { category: 'Sleep better' },
            path: 'simple',
            brain_dump_raw: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ current_step: 4 }] });
    const r = await advanceStep(CTX, { target_step: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.current_step).toBe(4);
    const [sql] = pool.query.mock.calls[1];
    expect(sql).toMatch(/current_step = \$2/);
    expect(sql).not.toMatch(/GREATEST/);
  });

  it('back-nav: target below current_step is allowed and skips the data guard', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ current_step: 5, data: {}, path: 'simple', brain_dump_raw: null }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ current_step: 3 }] });
    const r = await advanceStep(CTX, { target_step: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.current_step).toBe(3);
  });

  it('stale high-water: current=7, target=4 bare-sets to 4 (no precondition)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ current_step: 7, data: {}, path: 'simple', brain_dump_raw: null }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ current_step: 4 }] });
    const r = await advanceStep(CTX, { target_step: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.current_step).toBe(4);
  });
});

// ─── confirm_plan ────────────────────────────────────────────────────

describe('confirm_plan', () => {
  it('rejects when habits + reflection are not yet saved', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 5 }] });
    const r = await confirmPlan(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'handler_error' });
    if (!r.ok) expect(r.message).toMatch(/confirm_plan_too_early/);
  });

  it('rejects when reflection missing even though habits exist', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { habitConfigs: { Walk: {} } }, current_step: 6 }],
    });
    const r = await confirmPlan(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'handler_error' });
  });

  it('confirms when habits + reflection both present', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          data: { habitConfigs: { Walk: {} }, reflectionConfig: { time: '21:00' } },
          current_step: 7,
        },
      ],
    });
    const r = await confirmPlan(CTX, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toMatchObject({ confirmed: true });
  });
});
