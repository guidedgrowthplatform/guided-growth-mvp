/**
 * Security tests for the Vapi navigate_next handler.
 *
 * The advance is server-gated: navigate_next derives the source screen from the
 * trusted persisted (current_step, path), then runs the same REQUIRED/NEXT_STEP
 * gate as confirm_step_complete. The LLM's target_step is never written, so
 * voice cannot skip a step whose required data is missing, move backward, or
 * jump forward.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { navigateNext } = await import('../navigateNext.js');

const ANON = '11111111-1111-4111-8111-111111111111';

// Query sequence per call:
//   0: INSERT ... ON CONFLICT DO NOTHING
//   1: SELECT current_step, path        (navigateNext)
//   2: SELECT data, path, current_step  (advanceStepIfReady)
//   3: UPDATE ... GREATEST              (advanceStepIfReady, only if advancing)
function seedState(currentStep: number, path: string | null) {
  pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // INSERT
  pool.query.mockResolvedValueOnce({ rows: [{ current_step: currentStep, path }] }); // SELECT step/path
}
function gateRow(data: Record<string, unknown> | null, path: string | null, currentStep: number) {
  pool.query.mockResolvedValueOnce({ rows: [{ data, path, current_step: currentStep }] });
}
function bump(nextStep: number) {
  pool.query.mockResolvedValueOnce({ rows: [{ current_step: nextStep }] });
}

beforeEach(() => vi.clearAllMocks());

describe('navigate_next — identity + arg validation', () => {
  it('rejects a missing anon_id, no DB write', async () => {
    const r = await navigateNext({ target_step: 2 });
    expect(r).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a malformed anon_id', async () => {
    const r = await navigateNext({ anon_id: 'not-a-uuid', target_step: 2 });
    expect(r).toEqual({ error: 'invalid_identity' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a non-integer target_step', async () => {
    const r = await navigateNext({ anon_id: ANON, target_step: 'abc' });
    expect(r).toEqual({ error: 'validation_failed: target_step must be an integer' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range target_step', async () => {
    const r = await navigateNext({ anon_id: ANON, target_step: 99 });
    expect(r).toMatchObject({ error: expect.stringContaining('between 1 and 10') });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('navigate_next — premature forward advance is rejected', () => {
  const cases: Array<{
    name: string;
    step: number;
    path: string | null;
    data: Record<string, unknown>;
  }> = [
    { name: 'step 1 profile incomplete', step: 1, path: null, data: {} },
    { name: 'step 1 only nickname', step: 1, path: null, data: { nickname: 'alice' } },
    { name: 'step 2 no path chosen', step: 2, path: null, data: {} },
    { name: 'step 3 beginner no category', step: 3, path: 'simple', data: {} },
    { name: 'step 4 beginner no goals', step: 4, path: 'simple', data: { goals: [] } },
    { name: 'step 5 beginner no habits', step: 5, path: 'simple', data: { habitConfigs: {} } },
    { name: 'step 6 beginner no reflectionConfig', step: 6, path: 'simple', data: {} },
    { name: 'step 3 advanced empty braindump', step: 3, path: 'braindump', data: {} },
  ];

  for (const c of cases) {
    it(`rejects: ${c.name} — LLM asks to jump forward but data missing`, async () => {
      seedState(c.step, c.path);
      gateRow(c.data, c.path, c.step);
      // LLM tries to jump way ahead — target_step is ignored; gate blocks.
      const r = await navigateNext({ anon_id: ANON, target_step: 10 });
      expect(r).toEqual({ error: 'no_advance: required_missing' });
      // No UPDATE ran (INSERT + 2 SELECTs only).
      expect(pool.query).toHaveBeenCalledTimes(3);
    });
  }
});

describe('navigate_next — legitimate advance passes', () => {
  it('step 1 → 2 when all four profile fields present', async () => {
    const data = { nickname: 'alice', age: 28, gender: 'Female', referralSource: 'Reddit' };
    seedState(1, null);
    gateRow(data, null, 1);
    bump(2);
    const r = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(r).toEqual({ result: 'ok' });
    const update = pool.query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    expect(update?.[1]).toEqual([ANON, 2]);
  });

  it('step 2 → 3 when path chosen (fork keys off path column)', async () => {
    seedState(2, 'simple');
    gateRow({}, 'simple', 2);
    bump(3);
    const r = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(r).toEqual({ result: 'ok' });
    const update = pool.query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    expect(update?.[1]).toEqual([ANON, 3]);
  });

  it('step 3 advanced → 4 when braindump present', async () => {
    seedState(3, 'braindump');
    gateRow({ brainDumpText: 'I want to sleep better' }, 'braindump', 3);
    bump(4);
    const r = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(r).toEqual({ result: 'ok' });
    const update = pool.query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    expect(update?.[1]).toEqual([ANON, 4]);
  });
});

describe('navigate_next — backward / multi-jump is not honored', () => {
  it('ignores a backward target_step; GREATEST keeps step monotonic', async () => {
    // User is at step 5 with valid habits; LLM asks to go back to step 1.
    seedState(5, 'simple');
    gateRow({ habitConfigs: { Walk: {} } }, 'simple', 5);
    bump(6); // GREATEST(5, 6) — never lowers
    const r = await navigateNext({ anon_id: ANON, target_step: 1 });
    expect(r).toEqual({ result: 'ok' });
    const update = pool.query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    // Written next step is derived from persisted step 5 (→6), not the LLM's 1.
    expect(update?.[1]).toEqual([ANON, 6]);
  });

  it('a forward jump only ever advances one mapped step (target_step 10 ignored)', async () => {
    seedState(3, 'simple');
    gateRow({ category: 'Sleep better' }, 'simple', 3);
    bump(4);
    const r = await navigateNext({ anon_id: ANON, target_step: 10 });
    expect(r).toEqual({ result: 'ok' });
    const update = pool.query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    expect(update?.[1]).toEqual([ANON, 4]); // one step, not to 10
  });
});
