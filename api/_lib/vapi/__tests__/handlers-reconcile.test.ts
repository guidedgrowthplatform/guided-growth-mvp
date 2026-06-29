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
const { submitMorningCheckin } = await import('../handlers/submitMorningCheckin.js');
const { confirmPlan } = await import('../handlers/confirmPlan.js');
const { updateHabit } = await import('../handlers/updateHabit.js');
const { navigateNext } = await import('../handlers/navigateNext.js');

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

// The two-call pattern: call 1 names the habit + polarity, call 2 sets the
// schedule with no habit_type. The DB-side per-name deep-merge must keep the
// prior habitType instead of wiping it back to binary_do.
describe('vapi addHabit — polarity preservation', () => {
  it('call 1 stages habitType under the name key ($4)', async () => {
    await addHabit({ anon_id: ANON, name: 'no news', habit_type: 'binary_avoid' });
    const params = pool.query.mock.calls[0][1] as unknown[];
    const merge = JSON.parse(params[2] as string);
    expect(merge['no news'].habitType).toBe('binary_avoid');
    expect(params[3]).toBe('no news'); // $4 == name key
  });

  it('schedule-only call omits habitType and uses the per-name deep-merge', async () => {
    await addHabit({ anon_id: ANON, name: 'no news', schedule: 'Every day' });
    const params = pool.query.mock.calls[0][1] as unknown[];
    const sql = pool.query.mock.calls[0][0] as string;
    const merge = JSON.parse(params[2] as string);
    // No habitType in this payload → it can't overwrite the staged value.
    expect(merge['no news'].habitType).toBeUndefined();
    // Per-name merge (not flat `|| $3`) is what preserves the prior habitType.
    expect(sql).toMatch(/jsonb_build_object/);
    expect(sql).toMatch(/->'habitConfigs'->\$4/);
    expect(sql).toMatch(/\(\$3::jsonb -> \$4\)/);
    expect(params[3]).toBe('no news');
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

  // Regression for the rapid-chain-skips-reflection bug (feat/onboarding-voice-cleanup).
  // The model used to fire submit_reflection_config with NO fields, relying on a
  // (false) tool-description promise that the server would fill defaults. The
  // server actually requires all four — these tests pin that down so a future
  // "let the server fill defaults" patch can't silently re-open the loophole.
  it('rejects call with no fields (no silent server defaults)', async () => {
    const res = await submitReflectionConfig({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('time') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call missing time', async () => {
    const res = await submitReflectionConfig({
      anon_id: ANON,
      days: [1, 2, 3, 4, 5],
      reminder: true,
      schedule: 'Weekday',
    });
    expect(res).toMatchObject({ error: expect.stringContaining('time') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call missing days', async () => {
    const res = await submitReflectionConfig({
      anon_id: ANON,
      time: '21:45',
      reminder: true,
      schedule: 'Weekday',
    });
    expect(res).toMatchObject({ error: expect.stringContaining('days') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call missing reminder', async () => {
    const res = await submitReflectionConfig({
      anon_id: ANON,
      time: '21:45',
      days: [1, 2, 3, 4, 5],
      schedule: 'Weekday',
    });
    expect(res).toMatchObject({ error: expect.stringContaining('reminder') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call missing schedule', async () => {
    const res = await submitReflectionConfig({
      anon_id: ANON,
      time: '21:45',
      days: [1, 2, 3, 4, 5],
      reminder: true,
    });
    expect(res).toMatchObject({ error: expect.stringContaining('schedule') });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('vapi submitMorningCheckin — reconciliation + validation', () => {
  it('writes under the morningCheckin key (not reflectionConfig)', async () => {
    await submitMorningCheckin({
      anon_id: ANON,
      time: '07:30',
      days: [1, 2, 3, 4, 5],
      reminder: true,
      schedule: 'Weekday',
    });
    const payload = JSON.parse(pool.query.mock.calls[0][1][1] as string);
    expect(payload.morningCheckin).toBeDefined();
    expect(payload.reflectionConfig).toBeUndefined();
    expect(payload.morningCheckin.time).toBe('07:30');
  });

  it('reconciles stale schedule label against days (Every day -> Weekday)', async () => {
    await submitMorningCheckin({
      anon_id: ANON,
      time: '07:30',
      days: [1, 2, 3, 4, 5],
      reminder: true,
      schedule: 'Every day',
    });
    const payload = JSON.parse(pool.query.mock.calls[0][1][1] as string);
    expect(payload.morningCheckin.schedule).toBe('Weekday');
    expect(payload.morningCheckin.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps LLM label when days is a custom combination', async () => {
    await submitMorningCheckin({
      anon_id: ANON,
      time: '07:30',
      days: [1, 3, 5],
      reminder: true,
      schedule: 'Weekday',
    });
    const payload = JSON.parse(pool.query.mock.calls[0][1][1] as string);
    expect(payload.morningCheckin.schedule).toBe('Weekday');
    expect(payload.morningCheckin.days).toEqual([1, 3, 5]);
  });

  it('rejects invalid identity', async () => {
    const res = await submitMorningCheckin({
      anon_id: 'not-a-uuid',
      time: '07:30',
      days: [1],
      reminder: true,
      schedule: 'Every day',
    });
    expect(res).toMatchObject({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call with no fields (no silent server defaults)', async () => {
    const res = await submitMorningCheckin({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('time') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call missing days', async () => {
    const res = await submitMorningCheckin({
      anon_id: ANON,
      time: '07:30',
      reminder: true,
      schedule: 'Weekday',
    });
    expect(res).toMatchObject({ error: expect.stringContaining('days') });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects call missing schedule', async () => {
    const res = await submitMorningCheckin({
      anon_id: ANON,
      time: '07:30',
      days: [1, 2, 3, 4, 5],
      reminder: true,
    });
    expect(res).toMatchObject({ error: expect.stringContaining('schedule') });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('vapi navigateNext — skip + precondition guards', () => {
  it('rejects multi-step forward jump (step 1 → 3)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ current_step: 1, data: { nickname: 'Yair' }, path: null, brain_dump_raw: null }],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(res).toMatchObject({ error: expect.stringContaining('cannot_skip_steps') });
    // Only the SELECT ran — no UPSERT.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  // tap→voice catch-up: user tapped into the reflection screen (current_step
  // stays at the habits step) then advanced by voice — a +2 jump.
  it('allows +2 catch-up when both skipped steps have data (step 5 → 7)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 5,
            data: { habitConfigs: { Run: {} }, reflectionConfig: { time: '21:00' } },
            path: 'simple',
            brain_dump_raw: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await navigateNext({ anon_id: ANON, target_step: 7 });
    expect(res).toEqual({ result: 'ok' });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('rejects +2 catch-up when an intermediate step is missing data (step 7 → 9, no morningCheckin)', async () => {
    // Canonical tail: case 7 passes through, case 8 gates on morningCheckin.
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          current_step: 7,
          data: { habitConfigs: { Run: {} } },
          path: 'simple',
          brain_dump_raw: null,
        },
      ],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 9 });
    expect(res).toMatchObject({ error: expect.stringContaining('cannot_skip_steps') });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('rejects +3 jumps outright even with data present (step 4 → 7)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          current_step: 4,
          data: { goals: ['x'], habitConfigs: { Run: {} }, reflectionConfig: { time: '21:00' } },
          path: 'simple',
          brain_dump_raw: null,
        },
      ],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 7 });
    expect(res).toMatchObject({ error: expect.stringContaining('cannot_skip_steps') });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('rejects single-step forward when source data missing (step 1 → 2 with no nickname)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ current_step: 1, data: {}, path: null, brain_dump_raw: null }],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(res).toMatchObject({ error: expect.stringContaining('profile_missing') });
    // Re-reads for the in-flight async submit, then rejects — never advances (no write).
    const wrote = pool.query.mock.calls.some((c) =>
      /INSERT INTO onboarding_states/i.test(String(c[0])),
    );
    expect(wrote).toBe(false);
  });

  it('rejects single-step forward at step 2 with no path (the reported bug)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          current_step: 2,
          data: { nickname: 'Yair' },
          path: null,
          brain_dump_raw: null,
        },
      ],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(res).toMatchObject({ error: expect.stringContaining('path_missing') });
  });

  it('allows single-step forward when source data is saved (step 1 → 2 with nickname)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ current_step: 1, data: { nickname: 'Yair' }, path: null, brain_dump_raw: null }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(res).toEqual({ result: 'ok' });
    // SELECT then UPSERT.
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('allows step 3 → 4 when category is saved (beginner path)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 3,
            data: { nickname: 'Yair', category: 'Sleep better' },
            path: 'simple',
            brain_dump_raw: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(res).toEqual({ result: 'ok' });
  });

  it('allows step 3 → 4 on advanced path when brain_dump_raw is saved', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 3,
            data: { nickname: 'Yair' },
            path: 'braindump',
            brain_dump_raw: 'I want to sleep more, walk daily, and meditate every morning.',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(res).toEqual({ result: 'ok' });
  });

  it('allows back-nav without precondition check (step 5 → 3 to re-edit)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 5,
            data: { nickname: 'Yair', category: 'Sleep better' },
            path: 'simple',
            brain_dump_raw: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(res).toEqual({ result: 'ok' });
  });

  it('rejects step 5 → 6 when no habits captured', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          current_step: 5,
          data: { nickname: 'Yair', category: 'Sleep better', goals: ['Wake up earlier'] },
          path: 'simple',
          brain_dump_raw: null,
        },
      ],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 6 });
    expect(res).toMatchObject({ error: expect.stringContaining('habits_missing') });
  });

  it('allows step 6 → 7 (leaving habit-schedule) when habits saved', async () => {
    // Canonical tail: case 6 now gates on habitConfigs, NOT reflection.
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 6,
            data: { habitConfigs: { Walk: { days: [1, 2, 3, 4, 5], time: '07:00' } } },
            path: 'simple',
            brain_dump_raw: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await navigateNext({ anon_id: ANON, target_step: 7 });
    expect(res).toEqual({ result: 'ok' });
  });

  it('rejects step 9 → 10 when reflection not saved', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          current_step: 9,
          data: {
            nickname: 'Yair',
            category: 'Sleep better',
            goals: ['Wake up earlier'],
            habitConfigs: { Walk: { days: [1, 2, 3, 4, 5], time: '07:00' } },
            morningCheckin: { time: '07:30', days: [1, 2, 3, 4, 5], reminder: true },
          },
          path: 'simple',
          brain_dump_raw: null,
        },
      ],
    });
    const res = await navigateNext({ anon_id: ANON, target_step: 10 });
    expect(res).toMatchObject({ error: expect.stringContaining('reflection_missing') });
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

  it('valid anon_id with habits + reflection: monotonic GREATEST bump to step 8, returns ok', async () => {
    // Precondition lookup: row has habits + reflection.
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          data: {
            habitConfigs: { Walk: { days: [1, 2, 3, 4, 5], time: '07:00' } },
            reflectionConfig: { time: '21:00', days: [1, 2, 3, 4, 5] },
          },
          current_step: 7,
        },
      ],
    });
    const res = await confirmPlan({ anon_id: ANON });
    expect(res).toEqual({ result: 'ok' });
    expect(pool.query).toHaveBeenCalledTimes(2);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toContain('GREATEST(onboarding_states.current_step, 8)');
    expect(params).toEqual([ANON]);
  });

  it('valid anon_id with advancedHabitConfigs + reflection: also passes precondition', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          data: {
            advancedHabitConfigs: { Run: { days: [1, 3, 5], time: '06:00' } },
            reflectionConfig: { time: '20:00', days: [0, 1, 2, 3, 4, 5, 6] },
          },
          current_step: 7,
        },
      ],
    });
    const res = await confirmPlan({ anon_id: ANON });
    expect(res).toEqual({ result: 'ok' });
  });

  it('missing habits: rejects with preconditions_not_met, no step bump', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { reflectionConfig: { time: '21:00' } }, current_step: 5 }],
    });
    const res = await confirmPlan({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('confirm_plan_too_early') });
    expect(res).toMatchObject({ error: expect.stringContaining('habits') });
    // Only the SELECT ran — no UPSERT.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('missing reflection: rejects with preconditions_not_met, no step bump', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          data: { habitConfigs: { Walk: { days: [1], time: '07:00' } } },
          current_step: 5,
        },
      ],
    });
    const res = await confirmPlan({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('confirm_plan_too_early') });
    expect(res).toMatchObject({ error: expect.stringContaining('reflection') });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('empty habitConfigs object: rejects (zero habits is not a valid plan)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data: { habitConfigs: {}, reflectionConfig: { time: '21:00' } }, current_step: 5 }],
    });
    const res = await confirmPlan({ anon_id: ANON });
    expect(res).toMatchObject({ error: expect.stringContaining('confirm_plan_too_early') });
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
