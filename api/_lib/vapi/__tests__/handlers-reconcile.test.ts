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
