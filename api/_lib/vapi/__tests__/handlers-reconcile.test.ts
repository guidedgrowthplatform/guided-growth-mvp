/**
 * Reconciliation tests for the Vapi onboarding handlers (Mint round-2).
 *
 * Days is the authoritative field. The schedule label is overwritten via
 * inferSchedule(days) so a stale chip from LLM drift (e.g.
 * `{days:[1..5], schedule:'Every day'}`) lands as
 * `{days:[1..5], schedule:'Weekday'}`. PlanReviewPage then reads
 * formatCadence(days) alone and gets a faithful cadence label.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
};

const { addHabit } = await import('../handlers/addHabit.js');
const { submitReflectionConfig } = await import('../handlers/submitReflectionConfig.js');
const { confirmPlan } = await import('../handlers/confirmPlan.js');
const { updateHabit } = await import('../handlers/updateHabit.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  // addHabit returns ok only when RETURNING anon_id rowCount > 0.
  pool.query.mockResolvedValue({ rowCount: 1, rows: [{ anon_id: ANON }] });
});

describe('vapi addHabit — reconciliation', () => {
  it('both given + days match preset: schedule reflects the days (Every day -> Weekday)', async () => {
    await addHabit({
      anon_id: ANON,
      name: 'Walk',
      days: [1, 2, 3, 4, 5],
      schedule: 'Every day',
    });
    const params = pool.query.mock.calls[0][1];
    // $3 carries the per-name merge payload: { [name]: habitEntry }
    const merge = JSON.parse(params[2] as string);
    expect(merge.Walk.schedule).toBe('Weekday');
    expect(merge.Walk.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('both given + custom day combination: schedule falls back to LLM label', async () => {
    // Mon/Wed/Fri doesn't match any preset; inferSchedule returns null and
    // we keep what the LLM said. PlanReviewPage renders "3 days/week".
    await addHabit({
      anon_id: ANON,
      name: 'Walk',
      days: [1, 3, 5],
      schedule: 'Weekday',
    });
    const merge = JSON.parse(pool.query.mock.calls[0][1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekday'); // best-effort
    expect(merge.Walk.days).toEqual([1, 3, 5]);
  });

  it('both given + already consistent: no-op reconcile', async () => {
    await addHabit({
      anon_id: ANON,
      name: 'Walk',
      days: [1, 2, 3, 4, 5],
      schedule: 'Weekday',
    });
    const merge = JSON.parse(pool.query.mock.calls[0][1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekday');
    expect(merge.Walk.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('days only: schedule inferred from days', async () => {
    await addHabit({ anon_id: ANON, name: 'Walk', days: [0, 6] });
    const merge = JSON.parse(pool.query.mock.calls[0][1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekend');
    expect(merge.Walk.days).toEqual([0, 6]);
  });

  it('schedule only: days expanded from preset', async () => {
    await addHabit({ anon_id: ANON, name: 'Walk', schedule: 'Every day' });
    const merge = JSON.parse(pool.query.mock.calls[0][1][2] as string);
    expect(merge.Walk.schedule).toBe('Every day');
    expect(merge.Walk.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('neither: defaults to Weekday preset', async () => {
    await addHabit({ anon_id: ANON, name: 'Walk' });
    const merge = JSON.parse(pool.query.mock.calls[0][1][2] as string);
    expect(merge.Walk.schedule).toBe('Weekday');
    expect(merge.Walk.days).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('vapi submitReflectionConfig — reconciliation', () => {
  it('reconciles stale schedule label against days (Every day -> Weekday)', async () => {
    await submitReflectionConfig({
      anon_id: ANON,
      time: '21:45',
      days: [1, 2, 3, 4, 5],
      reminder: true,
      schedule: 'Every day',
    });
    const payload = JSON.parse(pool.query.mock.calls[0][1][1] as string);
    expect(payload.reflectionConfig.schedule).toBe('Weekday');
    expect(payload.reflectionConfig.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps LLM label when days is a custom combination', async () => {
    await submitReflectionConfig({
      anon_id: ANON,
      time: '21:45',
      days: [1, 3, 5],
      reminder: true,
      schedule: 'Weekday',
    });
    const payload = JSON.parse(pool.query.mock.calls[0][1][1] as string);
    expect(payload.reflectionConfig.schedule).toBe('Weekday');
    expect(payload.reflectionConfig.days).toEqual([1, 3, 5]);
  });

  it('canonical Weekend match: schedule infers from days', async () => {
    await submitReflectionConfig({
      anon_id: ANON,
      time: '21:45',
      days: [0, 6],
      reminder: true,
      schedule: 'Weekday', // stale
    });
    const payload = JSON.parse(pool.query.mock.calls[0][1][1] as string);
    expect(payload.reflectionConfig.schedule).toBe('Weekend');
    expect(payload.reflectionConfig.days).toEqual([0, 6]);
  });
});

describe('vapi confirmPlan — State-1 completion', () => {
  it('invalid anon_id: returns invalid_identity, no DB write', async () => {
    const res = await confirmPlan({ anon_id: 'not-a-uuid' });
    expect(res).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('missing anon_id: returns invalid_identity, no DB write', async () => {
    const res = await confirmPlan({});
    expect(res).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('valid anon_id: monotonic GREATEST bump to step 8, returns ok', async () => {
    const res = await confirmPlan({ anon_id: ANON });
    expect(res).toEqual({ result: 'ok' });
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('GREATEST(onboarding_states.current_step, 8)');
    expect(params).toEqual([ANON]);
  });
});

describe('vapi updateHabit — partial patch', () => {
  it('invalid anon_id: returns invalid_identity', async () => {
    const res = await updateHabit({ anon_id: 'not-a-uuid', name: 'Walk', time: '08:00' });
    expect(res).toEqual({ error: 'invalid_identity' });
  });

  it('idempotent ok + no write when the habit is absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ hc: { Run: { days: [1], time: '07:00' } } }] });
    const res = await updateHabit({ anon_id: ANON, name: 'Walk', time: '08:00' });
    expect(res).toEqual({ result: 'ok' });
    // Only the SELECT ran — no UPDATE for a habit that isn't there.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('patches only the provided field, preserving the rest (case-insensitive)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          hc: {
            Meditate: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true, schedule: 'Weekday' },
          },
        },
      ],
    });
    const res = await updateHabit({ anon_id: ANON, name: 'meditate', time: '08:00' });
    expect(res).toEqual({ result: 'ok' });
    // UPDATE is the 2nd query; $2 carries { [name]: mergedEntry }.
    const merge = JSON.parse(pool.query.mock.calls[1][1][1] as string);
    expect(merge.Meditate).toEqual({
      days: [1, 2, 3, 4, 5],
      time: '08:00',
      reminder: true,
      schedule: 'Weekday',
    });
  });

  it('days change re-infers schedule and preserves the untouched time', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          hc: {
            Walk: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true, schedule: 'Weekday' },
          },
        },
      ],
    });
    await updateHabit({ anon_id: ANON, name: 'Walk', days: [0, 6] });
    const merge = JSON.parse(pool.query.mock.calls[1][1][1] as string);
    expect(merge.Walk.days).toEqual([0, 6]);
    expect(merge.Walk.schedule).toBe('Weekend');
    expect(merge.Walk.time).toBe('07:00');
  });

  it('requires at least one field to change', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ hc: { Walk: { days: [1], time: '07:00' } } }] });
    const res = await updateHabit({ anon_id: ANON, name: 'Walk' });
    expect(res).toEqual({ error: 'validation_failed: provide at least one field to update' });
  });
});
