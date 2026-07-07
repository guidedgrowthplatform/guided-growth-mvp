import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};

const { MAX_HABITS, MAX_HABITS_ADVANCED } = await import('../schemas.js');

// addHabit runs inside pool.connect() — fake client routes by SQL shape.
// `path` is read alongside habitConfigs and drives the lane-aware cap
// (undefined path → beginner, the stricter cap).
function habitClient(opts: {
  hc?: Record<string, unknown> | null;
  upsert?: unknown;
  path?: string | null;
}) {
  const query = vi.fn(async (sql: string) => {
    if (/SELECT data->'habitConfigs'/.test(sql)) {
      return { rowCount: 1, rows: [{ hc: opts.hc ?? {}, path: opts.path ?? null }] };
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
const { submitWeeklyConfig } = await import('../handlers/submitWeeklyConfig.js');
const { submitMorningCheckin } = await import('../handlers/submitMorningCheckin.js');
const { submitBrainDump } = await import('../handlers/submitBrainDump.js');
const { advanceStep } = await import('../handlers/advanceStep.js');
const { confirmPlan } = await import('../handlers/confirmPlan.js');
const { recordCheckin } = await import('../handlers/recordCheckin.js');
const { checkAdvanceData } = await import('../preconditions.js');

const CTX = { anon_id: '11111111-1111-4111-8111-111111111111' };

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue({ rowCount: 1, rows: [] });
});

// ─── submit_profile ───────────────────────────────────────────────────

describe('submit_profile', () => {
  it('rejects a fully-empty payload', async () => {
    const r = await submitProfile(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('accepts age+gender without a nickname', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { age: 28, gender: 'Female' }, current_step: 1 }],
    });
    const r = await submitProfile(CTX, { age: '28', gender: 'Female' });
    expect(r.ok).toBe(true);
    const [, params] = pool.query.mock.calls[0];
    expect(JSON.parse(params[1] as string)).toEqual({ age: 28, gender: 'Female' });
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

  // ── G13 grounding guard ──────────────────────────────────────────────

  it('G13: rejects delegation turn "skip this too, just pick one for me"', async () => {
    const r = await submitPathChoice(
      { ...CTX, user_text: 'skip this too, just pick one for me' },
      { path: 'simple' },
    );
    expect(r).toMatchObject({
      ok: false,
      error: 'handler_error',
      message: 'path_choice_not_grounded',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('G13: accepts grounded simple turn "let\'s do the simple guided one"', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: {}, current_step: 2, path: 'simple' }],
    });
    const r = await submitPathChoice(
      { ...CTX, user_text: "let's do the simple guided one" },
      { path: 'simple' },
    );
    expect(r.ok).toBe(true);
  });

  it('G13: accepts grounded braindump turn "I already track my habits, brain dump"', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: {}, current_step: 2, path: 'braindump' }],
    });
    const r = await submitPathChoice(
      { ...CTX, user_text: 'I already track my habits, brain dump' },
      { path: 'braindump' },
    );
    expect(r.ok).toBe(true);
  });

  it('G13: bare "yes" passes (coach may have just proposed a specific path)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: {}, current_step: 2, path: 'simple' }],
    });
    const r = await submitPathChoice({ ...CTX, user_text: 'yes' }, { path: 'simple' });
    expect(r.ok).toBe(true);
  });

  it('G13: guard disabled when user_text is absent (Vapi parity)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: {}, current_step: 2, path: 'simple' }],
    });
    const r = await submitPathChoice(CTX, { path: 'simple' });
    expect(r.ok).toBe(true);
  });

  it('G13: rejects "you decide for me, doesn\'t matter"', async () => {
    const r = await submitPathChoice(
      { ...CTX, user_text: "you decide for me, doesn't matter" },
      { path: 'braindump' },
    );
    expect(r).toMatchObject({
      ok: false,
      error: 'handler_error',
      message: 'path_choice_not_grounded',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('G13: rejects an off-topic turn with no path signal', async () => {
    const r = await submitPathChoice({ ...CTX, user_text: 'what time is it?' }, { path: 'simple' });
    expect(r).toMatchObject({
      ok: false,
      error: 'handler_error',
      message: 'path_choice_not_grounded',
    });
    expect(pool.query).not.toHaveBeenCalled();
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

  // ─── Lane-aware cap (ledger ruling B37: "there is no limit in advanced") ──
  describe('lane-aware habit cap (B37)', () => {
    it('beginner path (simple): the third habit is still rejected at cap 2', async () => {
      const client = habitClient({ hc: atCap, path: 'simple' });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(CTX, { ...validHabit, name: 'ThirdHabit' });
      expect(r).toEqual({
        ok: false,
        error: 'handler_error',
        message: 'max_habits_reached',
      });
      const sqls = client.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(false);
      expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
    });

    it('advanced path (braindump): the third habit is accepted, not dropped', async () => {
      const client = habitClient({ hc: atCap, path: 'braindump' });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(CTX, { ...validHabit, name: 'ThirdHabit' });
      expect(r.ok).toBe(true);
      const sqls = client.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(true);
      expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(false);
    });

    it('advanced path: accepts habits well past the beginner cap', async () => {
      const tenExisting = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`Existing${i}`, {}]),
      );
      const client = habitClient({ hc: tenExisting, path: 'braindump' });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(CTX, { ...validHabit, name: 'EleventhHabit' });
      expect(r.ok).toBe(true);
      const sqls = client.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(true);
    });

    it('advanced path: only the safety ceiling stops it, and it SAYS so (non-silent)', async () => {
      const atCeiling = Object.fromEntries(
        Array.from({ length: MAX_HABITS_ADVANCED }, (_, i) => [`Existing${i}`, {}]),
      );
      const client = habitClient({ hc: atCeiling, path: 'braindump' });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(CTX, { ...validHabit, name: 'OverTheCeiling' });
      expect(r).toEqual({
        ok: false,
        error: 'handler_error',
        message: 'max_habits_capacity',
      });
      const sqls = client.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(false);
      expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
    });
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

  it('persists an explicit binary_avoid habit_type', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { ...validHabit, habit_type: 'binary_avoid' });
    expect(persistedHabit(client).habitType).toBe('binary_avoid');
  });

  // Two-call pattern: a prior add_habit staged habitType; the schedule call
  // omits it and must NOT wipe the avoid polarity back to do.
  it('preserves a prior habitType when the schedule call omits it', async () => {
    const client = habitClient({
      hc: { Walk: { days: [1], time: '07:00', schedule: 'Weekday', habitType: 'binary_avoid' } },
    });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, { name: 'Walk', schedule: 'Every day' });
    expect(persistedHabit(client).habitType).toBe('binary_avoid');
  });

  it('omits habitType entirely when neither the call nor a prior entry set it', async () => {
    const client = habitClient({ hc: {} });
    pool.connect.mockResolvedValue(client);
    await addHabit(CTX, validHabit);
    expect(persistedHabit(client).habitType).toBeUndefined();
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

  // ─── B54 data-integrity guard: reject a name ungrounded in the turn ────
  describe('data-integrity guard (B54)', () => {
    it('rejects a preset-shaped name with no overlap with the raw turn text', async () => {
      // rambler trail F3: user described charging their phone in the kitchen;
      // the model tried to save the nearby preset instead of their own words.
      const client = habitClient({ hc: {} });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(
        {
          ...CTX,
          user_text: 'putting my phone on the charger in the kitchen instead of the nightstand',
        },
        { ...validHabit, name: 'No screens after 10 PM' },
      );
      expect(r).toEqual({
        ok: false,
        error: 'handler_error',
        message: 'habit_name_ungrounded',
      });
      const sqls = client.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => /INSERT INTO onboarding_states/.test(s))).toBe(false);
      expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
    });

    it('does NOT catch a name built from a real word in an off-topic turn (documented limit)', async () => {
      // rambler-advanced trail F4: a clarifying question mentioning the word
      // "sleep" produced a fabricated Sleep habit with an invented time and
      // schedule. The guard is a lexical name/turn-text overlap check, so a
      // name built from a word that really is in the turn text (here,
      // "sleep") passes it even though no habit was actually described. This
      // class of fabrication (a real word, but never offered as a habit to
      // track) is a semantic judgment the server cannot make reliably from
      // string overlap alone; it's covered instead by the addendum's leg (a)
      // ("never invent or infer data ... a clarifying question ... is not
      // data"), not by this handler-level guard. Documented here so the
      // boundary is explicit rather than silently assumed.
      const client = habitClient({ hc: {} });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(
        {
          ...CTX,
          user_text:
            'Sorry, what were you asking? I want to make sure my sleep goal actually gets tracked with the rest of this',
        },
        { name: 'Sleep', schedule: 'Every day', time: '22:00' },
      );
      expect(r.ok).toBe(true);
    });

    it('accepts a custom habit name that genuinely matches the user turn', async () => {
      const client = habitClient({ hc: {} });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(
        {
          ...CTX,
          user_text: 'putting my phone on the charger in the kitchen instead of the nightstand',
        },
        { ...validHabit, name: 'Charge phone in the kitchen' },
      );
      expect(r.ok).toBe(true);
    });

    it('still accepts a genuine preset match when the user actually said it', async () => {
      // No regression: when the user's own words really are the preset, the
      // guard must not block it.
      const client = habitClient({ hc: {} });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(
        { ...CTX, user_text: 'no screens after 10 PM, that is the one I want' },
        { ...validHabit, name: 'No screens after 10 PM' },
      );
      expect(r.ok).toBe(true);
    });

    it('does not guard when no raw turn text is supplied (backward compatible)', async () => {
      const client = habitClient({ hc: {} });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(CTX, { ...validHabit, name: 'No screens after 10 PM' });
      expect(r.ok).toBe(true);
    });

    // ─── W2-E: confirm-turn grounding window ───
    describe('confirm-turn grounding window (user_text_window)', () => {
      it('two-turn confirm shape passes: name grounds in an earlier window entry, not the current short reply', async () => {
        // turn 1: "I want to stop doomscrolling at night" (names the habit)
        // turn 2 (current): "yes please add it" (confirms, triggers the call)
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add it',
            user_text_window: ['yes please add it', 'I want to stop doomscrolling at night'],
          },
          { ...validHabit, name: 'Stop doomscrolling at night' },
        );
        expect(r.ok).toBe(true);
      });

      it('still rejects when the name grounds in NOTHING across the whole window', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add it',
            user_text_window: ['yes please add it', 'what do you think about the weather today'],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('window absent falls back to the exact current-turn-only behavior (rejects)', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'putting my phone on the charger in the kitchen instead of the nightstand',
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('window absent falls back to the exact current-turn-only behavior (accepts)', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          { ...CTX, user_text: 'no screens after 10 PM, that is the one I want' },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r.ok).toBe(true);
      });

      it('an empty window array falls back to the current-turn-only check', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'no screens after 10 PM, that is the one I want',
            user_text_window: [],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r.ok).toBe(true);
      });
    });

    // ─── W2-H: affirmed-coach-proposal deadlock ───
    describe('affirmed coach proposal (assistant_text_window)', () => {
      it('bare "yes" after a coach turn naming the preset is accepted', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add it',
            user_text_window: ['yes please add it'],
            assistant_text_window: [
              "It seems like I need to stick to the specific habits available. How about 'No screens after 10 PM'?",
            ],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r.ok).toBe(true);
      });

      it('a variant bare affirmation ("yes please add the first one") is accepted', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add the first one',
            user_text_window: ['yes please add the first one'],
            assistant_text_window: ["I'd suggest 'No screens after 10 PM' or 'Morning walk'."],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r.ok).toBe(true);
      });

      it('bare "yes" with no coach-named habit in the assistant window is still rejected', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add it',
            user_text_window: ['yes please add it'],
            assistant_text_window: ['What kind of habit would you like to work on?'],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('bare "yes" with no assistant_text_window supplied at all is still rejected (backward compatible)', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add it',
            user_text_window: ['yes please add it'],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('a non-affirmation turn never consults the assistant window, even if the name grounds there', async () => {
        // The current turn carries its OWN content (a different, unrelated
        // sentence) rather than a bare yes — the assistant window must not be
        // consulted, so a name that only grounds in the coach's proposal still
        // rejects here.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'what time does the app usually recommend for habits like this',
            user_text_window: ['what time does the app usually recommend for habits like this'],
            assistant_text_window: ["How about 'No screens after 10 PM'?"],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('a refusal turn is never treated as an affirmation, even with a coach-named habit in window', async () => {
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'no, not that one',
            user_text_window: ['no, not that one'],
            assistant_text_window: ["How about 'No screens after 10 PM'?"],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('does not consult the assistant window at all when the user window already grounds the name', async () => {
        // Regression guard: when the user already grounds the name themselves,
        // the affirmed-coach-proposal path must not even be reached (ungrounded
        // is false, so affirmedCoachProposal short-circuits) — assert success
        // stands even with an assistant window that would NOT ground the name.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'no screens after 10 PM, that is the one I want',
            user_text_window: ['no screens after 10 PM, that is the one I want'],
            assistant_text_window: ['What kind of habit would you like to work on?'],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r.ok).toBe(true);
      });
    });

    // ─── B59: user content outranks a coach proposal ───
    describe('user-content precedence over a coach proposal (B59)', () => {
      it('rejects a coach-proposed name on an ambiguous yes when the user stated their own habit earlier', async () => {
        // Reproduces the round-3 skipper trail: the user said "stop
        // doomscrolling" a couple of turns back, then gave an ambiguous
        // "yes", and the coach tried to save its OWN suggested "Same
        // bedtime" preset instead of the user's own habit. The name grounds
        // in the assistant window (the coach really did propose it) and the
        // current turn really is a bare affirmation, so before B59 this
        // passed through the W2-H escape hatch. The user's own prior content
        // must gate that hatch closed.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes',
            user_text_window: ['yes', 'stop doomscrolling at night'],
            assistant_text_window: ["How about 'Same bedtime' instead?"],
          },
          { ...validHabit, name: 'Same bedtime' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('still accepts the bare-yes-to-coach-preset deadlock when the user stated no content of their own', async () => {
        // The true deadlock this rule must not break: every entry in the
        // user window is itself just an affirmation (nothing of the user's
        // own to outrank), so the coach's concretely-named proposal still
        // grounds through the escape hatch.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes please add it',
            user_text_window: ['yes please add it', 'yeah', ''],
            assistant_text_window: ["How about 'No screens after 10 PM'?"],
          },
          { ...validHabit, name: 'No screens after 10 PM' },
        );
        expect(r.ok).toBe(true);
      });

      it('an explicit refusal still blocks the save even when the user stated their own habit earlier', async () => {
        // Precedence is about which CONTENT grounds the name, not a license
        // to save over a refusal. A "no" is never a bare affirmation
        // regardless of what precedes it, so the coach-proposal escape
        // hatch is never reached here and the save is rejected exactly as
        // rule 4 (no saving a declined thing) requires.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'no, not that one',
            user_text_window: ['no, not that one', 'stop doomscrolling at night'],
            assistant_text_window: ["How about 'Same bedtime' instead?"],
          },
          { ...validHabit, name: 'Same bedtime' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });
    });

    it('does not guard an edit to an already-added habit (schedule-only follow-up call)', async () => {
      // Two-call configure pattern: the schedule call reasonably won't
      // restate the habit's name, so the guard must not fire on an edit.
      const client = habitClient({ hc: { Walk: {} } });
      pool.connect.mockResolvedValue(client);
      const r = await addHabit(
        { ...CTX, user_text: 'every weekday at 7am please' },
        { ...validHabit, name: 'Walk' },
      );
      expect(r.ok).toBe(true);
    });

    // ─── B60: explicit-correction priority ───
    describe('explicit-correction priority (B60)', () => {
      it('rejects the discarded reading when the user explicitly corrects ("I said work more, not walk more")', async () => {
        // The tester trail: user said "work more" as their goal, the transcript
        // heard "walk more", the coach tried to save "Walk more", then the user
        // corrected ("I said work more, not walk more"). The coach must reject
        // "Walk more" and re-ask — looksUngrounded alone does NOT catch this
        // because both terms share tokens in the correction text.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'I said work more, not walk more',
            user_text_window: ['I said work more, not walk more'],
          },
          { ...validHabit, name: 'Walk more' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('accepts the corrected reading when coach saves it after the correction', async () => {
        // After a correction the coach should save the corrected term.
        // "Work more" passes because it does NOT match the discarded term "walk".
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'I said work more, not walk more',
            user_text_window: ['I said work more, not walk more'],
          },
          { ...validHabit, name: 'Work more' },
        );
        expect(r.ok).toBe(true);
      });

      it('rejects the discarded reading when the correction appears in a prior window turn', async () => {
        // The correction may have been in the previous turn; the current turn is
        // a bare "yes" or a follow-on. The guard still fires from the window.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'yes',
            user_text_window: ['yes', "I didn't say walk, I said work"],
          },
          { ...validHabit, name: 'Walk' },
        );
        expect(r).toEqual({
          ok: false,
          error: 'handler_error',
          message: 'habit_name_ungrounded',
        });
      });

      it('does not fire when the correction turn names an unrelated word (safe non-match)', async () => {
        // "I meant exercise, not workout" — the coach saves "Exercise", which is
        // the corrected-to term, not the discarded term. Must pass.
        const client = habitClient({ hc: {} });
        pool.connect.mockResolvedValue(client);
        const r = await addHabit(
          {
            ...CTX,
            user_text: 'I meant exercise, not workout',
            user_text_window: ['I meant exercise, not workout'],
          },
          { ...validHabit, name: 'Exercise' },
        );
        expect(r.ok).toBe(true);
      });
    });
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

  it('accepts valid config, GREATEST-bumps current_step to the V3 reflection step (8)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { reflectionConfig: valid }, current_step: 8 }],
    });
    const r = await submitReflectionConfig(CTX, valid);
    expect(r.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    // Voice save == tap save: bump to the beat's own persist step, never rewind.
    expect(sql).toMatch(/current_step = GREATEST\(onboarding_states.current_step, 8\)/);
    expect(sql).toMatch(/VALUES \(\$1, 8,/);
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

  // ─── B58 setup-config guard: reject a refused/ungrounded reflection save ──
  describe('setup-config guard (B58)', () => {
    it('rejects an explicit refusal of the evening reflection', async () => {
      const r = await submitReflectionConfig(
        { ...CTX, user_text: "I don't want the evening reflection either." },
        valid,
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'config_refused_by_user' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects an ungrounded off-topic turn', async () => {
      const r = await submitReflectionConfig(
        { ...CTX, user_text: 'What do you think about the news lately?' },
        valid,
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'config_not_grounded' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts a bare affirmation to a coach proposal', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { reflectionConfig: valid }, current_step: 8 }],
      });
      const r = await submitReflectionConfig({ ...CTX, user_text: 'Yes please.' }, valid);
      expect(r.ok).toBe(true);
    });

    it('does not guard when no raw turn text is supplied (backward compatible)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { reflectionConfig: valid }, current_step: 8 }],
      });
      const r = await submitReflectionConfig(CTX, valid);
      expect(r.ok).toBe(true);
    });

    it('still accepts a genuine cooperative setup turn (no false positive)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { reflectionConfig: valid }, current_step: 8 }],
      });
      const r = await submitReflectionConfig(
        { ...CTX, user_text: '9pm every day, no reminder needed.' },
        valid,
      );
      expect(r.ok).toBe(true);
    });
  });
});

// ─── submit_weekly_config ────────────────────────────────────────────

describe('submit_weekly_config', () => {
  it('rejects missing day', async () => {
    const r = await submitWeeklyConfig(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects day out of range', async () => {
    const r = await submitWeeklyConfig(CTX, { day: 7 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects a negative day', async () => {
    const r = await submitWeeklyConfig(CTX, { day: -1 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects a non-integer day', async () => {
    const r = await submitWeeklyConfig(CTX, { day: 2.5 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts Sunday (day=0), GREATEST-bumps current_step to the V3 weekly-day step (9)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { weeklyConfig: { day: 0 } }, current_step: 9 }],
    });
    const r = await submitWeeklyConfig(CTX, { day: 0 });
    expect(r.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/current_step = GREATEST\(onboarding_states.current_step, 9\)/);
    expect(sql).toMatch(/VALUES \(\$1, 9,/);
    expect(JSON.parse(params[1] as string)).toEqual({ weeklyConfig: { day: 0 } });
  });

  it('accepts a mid-week day (day=3)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { weeklyConfig: { day: 3 } }, current_step: 9 }],
    });
    const r = await submitWeeklyConfig(CTX, { day: 3 });
    expect(r).toMatchObject({ ok: true, result: { weeklyConfig: { day: 3 } } });
  });

  // ─── B58 setup-config guard: reject a refused/ungrounded weekly save ──────
  describe('setup-config guard (B58)', () => {
    it('rejects an explicit refusal of the weekly review', async () => {
      const r = await submitWeeklyConfig(
        { ...CTX, user_text: "I don't want the weekly review, skip it." },
        { day: 0 },
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'config_refused_by_user' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects an ungrounded clarifying question', async () => {
      const r = await submitWeeklyConfig(
        { ...CTX, user_text: 'Sorry, what were you asking?' },
        { day: 0 },
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'config_not_grounded' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts a bare affirmation to a coach-suggested Sunday default', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { weeklyConfig: { day: 0 } }, current_step: 9 }],
      });
      const r = await submitWeeklyConfig({ ...CTX, user_text: 'Sounds good.' }, { day: 0 });
      expect(r.ok).toBe(true);
    });

    it('does not guard when no raw turn text is supplied (backward compatible)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { weeklyConfig: { day: 0 } }, current_step: 9 }],
      });
      const r = await submitWeeklyConfig(CTX, { day: 0 });
      expect(r.ok).toBe(true);
    });

    it('still accepts a genuine day pick (no false positive)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { weeklyConfig: { day: 0 } }, current_step: 9 }],
      });
      const r = await submitWeeklyConfig(
        { ...CTX, user_text: "Let's do Sunday for the weekly review." },
        { day: 0 },
      );
      expect(r.ok).toBe(true);
    });
  });
});

// ─── submit_morning_checkin ──────────────────────────────────────────

describe('submit_morning_checkin', () => {
  const valid = {
    time: '09:00',
    days: [1, 2, 3, 4, 5],
    reminder: true,
    schedule: 'Weekday',
  };

  it('rejects invalid time', async () => {
    const r = await submitMorningCheckin(CTX, { ...valid, time: '99:99' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('rejects days out of range', async () => {
    const r = await submitMorningCheckin(CTX, { ...valid, days: [-1] });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('accepts valid config, bumps current_step to the V3 morning step (7)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { morningCheckin: valid }, current_step: 7 }],
    });
    const r = await submitMorningCheckin(CTX, valid);
    expect(r.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/current_step = GREATEST\(onboarding_states.current_step, 7\)/);
    expect(sql).toMatch(/VALUES \(\$1, 7,/);
    expect(JSON.parse(params[1] as string)).toEqual({ morningCheckin: valid });
  });

  // ─── B58 setup-config guard: the proven regression, now blocked server-side ──
  describe('setup-config guard (B58)', () => {
    it('rejects the exact reproduced regression: explicit morning refusal must not save', async () => {
      // This is the verbatim text from the live QA proof: submit_morning_checkin
      // fired with default config ({time:"09:00", days:[0..6], reminder:true})
      // ok:true, persisted, in the same turn as this refusal. See
      // gg-spec/tools/convo-harness/reports/b54-morning-refusal-proof.md and
      // qa-rounds/round2/resister/trail.md turn 12.
      const r = await submitMorningCheckin(
        {
          ...CTX,
          user_text: "I don't want to do a morning thing at all. Just the evening one.",
        },
        { time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], reminder: true, schedule: 'Every day' },
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'config_refused_by_user' });
      // B58 follow-up: the refusal is a terminal answer — a lightweight skip
      // marker is persisted (so the advance gate lets the flow leave the beat),
      // but never the refused config itself.
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toMatch(/data = onboarding_states.data \|\| \$2::jsonb/);
      expect(JSON.parse(params[1] as string)).toEqual({ morningCheckinSkipped: true });
    });

    it('the persisted skip marker satisfies the morning-setup advance gate (escape path)', async () => {
      // The !478 follow-up bug: after a correctly-rejected refusal the beat had
      // no terminal state, so the model retried submit_morning_checkin on later
      // turns and unrelated time/day content could silently save. The marker the
      // refusal writes must let advance_step leave the beat.
      await submitMorningCheckin(
        { ...CTX, user_text: "I don't want to do a morning thing at all. Just the evening one." },
        { time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], reminder: true, schedule: 'Every day' },
      );
      const written = JSON.parse(pool.query.mock.calls[0][1][1] as string);
      expect(
        checkAdvanceData({ sourceStep: 7, data: written, path: null, brainDumpRaw: null }),
      ).toBeNull();
    });

    it('rejects an ungrounded off-topic turn and does NOT write the skip marker', async () => {
      // Only an explicit refusal is a terminal answer; an off-topic turn must
      // leave the beat's gate untouched (no morningCheckinSkipped write).
      const r = await submitMorningCheckin(
        { ...CTX, user_text: 'Anyway, what do you think about the news lately?' },
        valid,
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'config_not_grounded' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts a bare affirmation to a coach-proposed time', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { morningCheckin: valid }, current_step: 7 }],
      });
      const r = await submitMorningCheckin({ ...CTX, user_text: 'Yes please.' }, valid);
      expect(r.ok).toBe(true);
    });

    it('does not guard when no raw turn text is supplied (backward compatible)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { morningCheckin: valid }, current_step: 7 }],
      });
      const r = await submitMorningCheckin(CTX, valid);
      expect(r.ok).toBe(true);
    });

    it('still accepts a genuine cooperative morning setup turn (no false positive)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { morningCheckin: valid }, current_step: 7 }],
      });
      const r = await submitMorningCheckin(
        { ...CTX, user_text: 'Every weekday at 9am, with a reminder.' },
        valid,
      );
      expect(r.ok).toBe(true);
    });
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
});

// ─── record_checkin ──────────────────────────────────────────────────

describe('record_checkin', () => {
  const VALID_ARGS = { sleep: 4, mood: 3, energy: 4, stress: 2 };

  it('rejects an empty payload (no dims)', async () => {
    const r = await recordCheckin(CTX, {});
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a dim value outside 1-5', async () => {
    const r = await recordCheckin(CTX, { sleep: 6 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('accepts a fully grounded turn and persists stateCheck', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { stateCheck: VALID_ARGS }, current_step: 6 }],
    });
    const r = await recordCheckin(
      { ...CTX, user_text: 'slept great, energy was high, mood is solid, stress low' },
      VALID_ARGS,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.stateCheck).toEqual(VALID_ARGS);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/current_step = GREATEST\(onboarding_states.current_step, 6\)/);
  });

  // ─── G12 grounding guard: the two observed fabrication shapes ───────
  describe('grounding guard (G12)', () => {
    it('rejects the exact "speed this up" bare-skip shape (observed fabrication 1)', async () => {
      // Round-3 corroboration: "speed this up" produced sleep:5 + other
      // fabricated values. The guard must reject before any DB write.
      const r = await recordCheckin({ ...CTX, user_text: 'speed this up' }, VALID_ARGS);
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'checkin_not_grounded' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects a reminders-only turn (observed fabrication 2)', async () => {
      // Round-3 corroboration (two personas): a turn about setting reminders
      // produced 4 fabricated state-check values. No state-check content
      // here, so the guard blocks.
      const r = await recordCheckin(
        { ...CTX, user_text: 'can you set up a reminder for me please' },
        VALID_ARGS,
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'checkin_not_grounded' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects an off-topic clarifying question', async () => {
      const r = await recordCheckin(
        { ...CTX, user_text: 'what do you think about the news lately?' },
        VALID_ARGS,
      );
      expect(r).toEqual({ ok: false, error: 'handler_error', message: 'checkin_not_grounded' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts a turn with explicit 1-5 ratings', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { stateCheck: VALID_ARGS }, current_step: 6 }],
      });
      const r = await recordCheckin(
        { ...CTX, user_text: 'sleep 4, mood 3, energy 4, stress 2' },
        VALID_ARGS,
      );
      expect(r.ok).toBe(true);
    });

    it('accepts a turn with state-check vocabulary (no explicit number)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { stateCheck: VALID_ARGS }, current_step: 6 }],
      });
      const r = await recordCheckin(
        { ...CTX, user_text: 'slept well, feeling great, not stressed at all' },
        VALID_ARGS,
      );
      expect(r.ok).toBe(true);
    });

    it('accepts a bare affirmation of a coach-proposed state assessment', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { stateCheck: VALID_ARGS }, current_step: 6 }],
      });
      const r = await recordCheckin({ ...CTX, user_text: 'yes please' }, VALID_ARGS);
      expect(r.ok).toBe(true);
    });

    it('does not guard when user_text is absent (backward compatible)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { stateCheck: VALID_ARGS }, current_step: 6 }],
      });
      const r = await recordCheckin(CTX, VALID_ARGS);
      expect(r.ok).toBe(true);
    });

    it('does not guard when user_text is empty (backward compatible)', async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ data: { stateCheck: VALID_ARGS }, current_step: 6 }],
      });
      const r = await recordCheckin({ ...CTX, user_text: '' }, VALID_ARGS);
      expect(r.ok).toBe(true);
    });
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
