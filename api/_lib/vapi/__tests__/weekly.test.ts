/**
 * Tests for The Weekly's Vapi tools: dispatch routing + the five handlers.
 * Mocking pattern mirrors handlers-reconcile.test.ts (mock ../../db.js,
 * handlers take (args, db = pool) directly).
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../db.js')).default as unknown as {
  query: ReturnType<typeof vi.fn>;
};

const { dispatchVapiToolCall } = await import('../dispatch.js');
const { weeklyUpdateHabit } = await import('../handlers/weeklyUpdateHabit.js');
const { weeklyArchiveHabit } = await import('../handlers/weeklyArchiveHabit.js');
const { weeklyAddHabit } = await import('../handlers/weeklyAddHabit.js');
const { weeklyComplete } = await import('../handlers/weeklyComplete.js');
const { weeklyAdvance } = await import('../handlers/weeklyAdvance.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dispatchVapiToolCall — weekly tool routing', () => {
  it('routes weekly_update_habit', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Walk' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // rename clash check: clear
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1' }] });
    const res = await dispatchVapiToolCall(
      'weekly_update_habit',
      { anon_id: ANON, name: 'Walk', new_name: 'Walk more' },
      pool,
    );
    expect(res).toEqual({ result: 'ok' });
  });

  it('routes weekly_archive_habit', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Walk' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await dispatchVapiToolCall(
      'weekly_archive_habit',
      { anon_id: ANON, name: 'Walk' },
      pool,
    );
    expect(res).toEqual({ result: 'ok' });
  });

  it('routes weekly_add_habit', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // no existing habit
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h2' }] });
    const res = await dispatchVapiToolCall(
      'weekly_add_habit',
      { anon_id: ANON, name: 'Stretch' },
      pool,
    );
    expect(res).toEqual({ result: 'ok' });
  });

  it('routes weekly_complete', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'w1' }] });
    const res = await dispatchVapiToolCall(
      'weekly_complete',
      { anon_id: ANON, focus: 'Sleep more' },
      pool,
    );
    expect(res).toEqual({ result: 'ok' });
  });

  it('routes weekly_advance (ack, no db call)', async () => {
    const res = await dispatchVapiToolCall('weekly_advance', { anon_id: ANON }, pool);
    expect(res).toEqual({ result: 'ok' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('still refuses unknown tool names', async () => {
    const res = await dispatchVapiToolCall('weekly_not_a_real_tool', { anon_id: ANON }, pool);
    expect(res).toMatchObject({ error: expect.stringContaining('unknown_tool') });
  });
});

describe('weeklyUpdateHabit', () => {
  it('rejects invalid identity, no DB write', async () => {
    const res = await weeklyUpdateHabit({
      anon_id: 'not-a-uuid',
      name: 'Walk',
      new_name: 'Walk more',
    });
    expect(res).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects when no fields to update are provided', async () => {
    const res = await weeklyUpdateHabit({ anon_id: ANON, name: 'Walk' });
    expect(res).toMatchObject({ error: expect.stringContaining('provide at least one field') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects when the habit is not found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = await weeklyUpdateHabit({ anon_id: ANON, name: 'Ghost habit', new_name: 'X' });
    expect(res).toMatchObject({ error: expect.stringContaining('not_found') });
  });

  it('renames a habit (the shrink-it move)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Read a chapter' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // rename clash check: clear
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1' }] });
    const res = await weeklyUpdateHabit({
      anon_id: ANON,
      name: 'Read a chapter',
      new_name: 'Read a page',
    });
    expect(res).toEqual({ result: 'ok' });
    const [sql, params] = pool.query.mock.calls[2];
    expect(sql).toMatch(/UPDATE user_habits/);
    expect(params[2]).toBe('Read a page'); // $3 = new_name
  });

  it('refuses a rename onto another existing habit (unique guard)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Read a chapter' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] }); // clash found
    const res = await weeklyUpdateHabit({
      anon_id: ANON,
      name: 'Read a chapter',
      new_name: 'Meditate',
    });
    expect(res).toMatchObject({ error: expect.stringContaining('already a habit called') });
    // No UPDATE fired: lookup + clash check only.
    expect(pool.query.mock.calls).toHaveLength(2);
  });

  it('maps frequency to cadence (the lower-the-frequency move)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Run' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1' }] });
    await weeklyUpdateHabit({ anon_id: ANON, name: 'Run', frequency: '3x/week' });
    const params = pool.query.mock.calls[1][1] as unknown[];
    expect(params[3]).toBe('3_specific_days'); // $4 = cadence
  });

  it('is case-insensitive on name lookup', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Meditate' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1' }] });
    await weeklyUpdateHabit({ anon_id: ANON, name: 'meditate', time: '08:00' });
    const lookupParams = pool.query.mock.calls[0][1] as unknown[];
    expect(lookupParams[1]).toBe('meditate');
  });

  it('rejects invalid frequency', async () => {
    const res = await weeklyUpdateHabit({ anon_id: ANON, name: 'Walk', frequency: 'never' });
    expect(res).toMatchObject({ error: expect.stringContaining('frequency must be one of') });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('weeklyArchiveHabit', () => {
  it('rejects invalid identity', async () => {
    const res = await weeklyArchiveHabit({ anon_id: 'nope', name: 'Walk' });
    expect(res).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects missing name', async () => {
    const res = await weeklyArchiveHabit({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('name is required') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects when habit not found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = await weeklyArchiveHabit({ anon_id: ANON, name: 'Ghost' });
    expect(res).toMatchObject({ error: expect.stringContaining('not_found') });
  });

  it('archives: sets is_active false + archived_at, never hard-deletes', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h1', name: 'Journaling' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await weeklyArchiveHabit({ anon_id: ANON, name: 'journaling' });
    expect(res).toEqual({ result: 'ok' });
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/UPDATE user_habits SET is_active = false, archived_at = now\(\)/);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(params).toEqual(['h1', ANON]);
  });
});

describe('weeklyAddHabit', () => {
  it('rejects invalid identity', async () => {
    const res = await weeklyAddHabit({ anon_id: 'nope', name: 'Stretch' });
    expect(res).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects missing name', async () => {
    const res = await weeklyAddHabit({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('name is required') });
  });

  it('rejects a duplicate habit name', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ name: 'Stretch' }] });
    const res = await weeklyAddHabit({ anon_id: ANON, name: 'stretch' });
    expect(res).toMatchObject({ error: expect.stringContaining('already have a habit') });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('inserts into user_habits (the live table, not onboarding_states)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h9' }] });
    const res = await weeklyAddHabit({ anon_id: ANON, name: 'Stretch', frequency: 'weekly' });
    expect(res).toEqual({ result: 'ok' });
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/INSERT INTO user_habits/);
    expect(sql).not.toMatch(/onboarding_states/);
    expect(params).toEqual([ANON, 'Stretch', 'binary_do', 'once_a_week', null]);
  });

  it('defaults habit_type to binary_do, accepts binary_avoid', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'h9' }] });
    await weeklyAddHabit({
      anon_id: ANON,
      name: 'No caffeine after 2pm',
      habit_type: 'binary_avoid',
    });
    const params = pool.query.mock.calls[1][1] as unknown[];
    expect(params[2]).toBe('binary_avoid');
  });
});

describe('weeklyComplete — upsert idempotency', () => {
  it('rejects invalid identity', async () => {
    const res = await weeklyComplete({ anon_id: 'nope' });
    expect(res).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('first call for the week: inserts a new weekly_sessions row', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'w1' }] });
    const res = await weeklyComplete({ anon_id: ANON, focus: 'Sleep more' });
    expect(res).toEqual({ result: 'ok' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO weekly_sessions/);
    expect(sql).toMatch(/ON CONFLICT \(anon_id, week_end\) DO UPDATE/);
    expect(params).toEqual([ANON, 'Sleep more']);
  });

  it('second call the same week: same statement runs again (upsert, not a duplicate insert path)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'w1' }] });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'w1' }] });
    const first = await weeklyComplete({ anon_id: ANON, focus: 'Sleep more' });
    const second = await weeklyComplete({ anon_id: ANON, focus: 'Sleep even more' });
    expect(first).toEqual({ result: 'ok' });
    expect(second).toEqual({ result: 'ok' });
    expect(pool.query).toHaveBeenCalledTimes(2);
    // Both calls hit the identical idempotent upsert statement.
    expect(pool.query.mock.calls[0][0]).toBe(pool.query.mock.calls[1][0]);
    expect(pool.query.mock.calls[1][1]).toEqual([ANON, 'Sleep even more']);
  });

  it('omitting focus preserves the existing focus via COALESCE', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'w1' }] });
    await weeklyComplete({ anon_id: ANON });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/COALESCE\(\$2, weekly_sessions\.focus\)/);
    expect(params).toEqual([ANON, null]);
  });
});

describe('weeklyAdvance', () => {
  it('always acks, makes no DB calls (server-side no-op)', async () => {
    const res = await weeklyAdvance({ anon_id: ANON });
    expect(res).toEqual({ result: 'ok' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('acks even with no args at all', async () => {
    const res = await weeklyAdvance({});
    expect(res).toEqual({ result: 'ok' });
  });
});
