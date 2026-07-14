/**
 * Security tests for the Vapi navigate_next handler.
 *
 * A forward advance (target_step > persisted step) is server-gated ATOMICALLY:
 * source screen, REQUIRED check, and the GREATEST UPDATE run against one
 * FOR-UPDATE-locked row, so a concurrent submit_path_choice can't swap `path`
 * between the source read and the gate. The LLM's target_step is never written.
 * A target <= persisted step is a back-nav ack (no write). So voice cannot skip
 * a step whose required data is missing, move backward, or jump forward.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// pool.query — used by navigateNext for INSERT/SELECT.
// pool.connect — used by advanceStepIfReadyAtomic for the FOR UPDATE txn.
const clientQuery = vi.fn();
const clientRelease = vi.fn();
vi.mock('../../../db.js', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(async () => ({ query: clientQuery, release: clientRelease })),
  },
}));

const pool = (await import('../../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};
const { navigateNext } = await import('../navigateNext.js');

const ANON = '11111111-1111-4111-8111-111111111111';

// navigateNext top-level pool.query sequence:
//   0: INSERT ... ON CONFLICT DO NOTHING
//   1: SELECT current_step
function seedState(currentStep: number | null) {
  pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // INSERT
  pool.query.mockResolvedValueOnce({
    rows: currentStep === null ? [] : [{ current_step: currentStep }],
  }); // SELECT current_step
}

// advanceStepIfReadyAtomic client sequence (only reached on a forward advance):
//   BEGIN → SELECT ... FOR UPDATE → (UPDATE|ROLLBACK) → COMMIT
function gateTxn(
  data: Record<string, unknown> | null,
  path: string | null,
  currentStep: number | null,
  nextStep?: number,
) {
  clientQuery.mockResolvedValueOnce(undefined); // BEGIN
  clientQuery.mockResolvedValueOnce({ rows: [{ data, path, current_step: currentStep }] }); // SELECT FOR UPDATE
  if (nextStep !== undefined) {
    clientQuery.mockResolvedValueOnce({ rows: [{ current_step: nextStep }] }); // UPDATE
    clientQuery.mockResolvedValueOnce(undefined); // COMMIT
  } else {
    clientQuery.mockResolvedValueOnce(undefined); // ROLLBACK
  }
}

function updateCall() {
  return clientQuery.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
}

beforeEach(() => {
  vi.clearAllMocks();
  pool.connect.mockImplementation(async () => ({ query: clientQuery, release: clientRelease }));
});

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
    {
      name: 'step 5 advanced no reflectionConfig (ADVANCED-04 gate)',
      step: 5,
      path: 'braindump',
      data: { brainDumpText: 'stuff' },
    },
  ];

  for (const c of cases) {
    it(`rejects: ${c.name} — LLM asks to jump forward but data missing`, async () => {
      seedState(c.step);
      // target_step beyond persisted → forward gate runs; blocks (no UPDATE).
      gateTxn(c.data, c.path, c.step);
      const r = await navigateNext({ anon_id: ANON, target_step: 10 });
      expect(r).toMatchObject({ error: expect.stringContaining('no_advance') });
      expect(updateCall()).toBeUndefined();
      expect(clientRelease).toHaveBeenCalled();
    });
  }
});

describe('navigate_next — legitimate advance passes', () => {
  it('step 1 → 2 when all four profile fields present', async () => {
    const data = { nickname: 'alice', age: 28, gender: 'Female', referralSource: 'Reddit' };
    seedState(1);
    gateTxn(data, null, 1, 2);
    const r = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 2]);
  });

  it('step 4 advanced → 5 (ADVANCED-02 has no REQUIRED gate — parity with direct lane)', async () => {
    seedState(4);
    gateTxn({}, 'braindump', 4, 5);
    const r = await navigateNext({ anon_id: ANON, target_step: 5 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 5]);
  });

  it('step 2 → 3 when path chosen (fork keys off path column)', async () => {
    seedState(2);
    gateTxn({}, 'simple', 2, 3);
    const r = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 3]);
  });

  it('step 3 advanced → 4 when braindump present', async () => {
    seedState(3);
    gateTxn({ brainDumpText: 'I want to sleep better' }, 'braindump', 3, 4);
    const r = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 4]);
  });

  it('step 5 advanced → 6 when reflectionConfig present (ADVANCED-04 gate)', async () => {
    seedState(5);
    gateTxn(
      { brainDumpText: 'x', reflectionConfig: { days: [1], prompts: ['a'] } },
      'braindump',
      5,
      6,
    );
    const r = await navigateNext({ anon_id: ANON, target_step: 6 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 6]);
  });
});

describe('navigate_next — backward / lateral is a no-write ack', () => {
  it('acks a backward target_step with no DB write (monotonic preserved)', async () => {
    // User back-navved; persisted still 5. LLM asks to go back to step 1.
    seedState(5);
    const r = await navigateNext({ anon_id: ANON, target_step: 1 });
    expect(r).toEqual({ result: 'ok' });
    // No forward gate txn ran.
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('acks a target_step == persisted step (walk-forward one screen at a time)', async () => {
    // AdvancedStep6Page persisted step 5; user editing step-3 page walks forward
    // one screen → LLM sends the next step, still <= persisted. Pure nav ack.
    seedState(5);
    const r = await navigateNext({ anon_id: ANON, target_step: 5 });
    expect(r).toEqual({ result: 'ok' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('navigate_next — edge rows', () => {
  it('missing DB row: persisted defaults to 1, forward advance runs the gate', async () => {
    seedState(null); // SELECT returns []
    // Atomic txn re-reads its own (also empty) row → step 1 / ONBOARD-01--FORM;
    // profile complete → advances to 2.
    gateTxn({ nickname: 'a', age: 20, gender: 'x', referralSource: 'y' }, null, 1, 2);
    const r = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 2]);
  });

  it('null path at step >= 3: no source screen → no_advance, no UPDATE', async () => {
    seedState(3);
    // path null at step 3 → sourceScreenForStep returns undefined (beginner map
    // miss); atomic gate rolls back with no_source_screen.
    gateTxn({ category: 'Sleep' }, null, 3);
    const r = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(r).toMatchObject({ error: expect.stringContaining('no_source_screen') });
    expect(updateCall()).toBeUndefined();
  });

  it('a forward jump only ever advances one mapped step (target_step 10 ignored)', async () => {
    seedState(3);
    gateTxn({ category: 'Sleep better' }, 'simple', 3, 4);
    const r = await navigateNext({ anon_id: ANON, target_step: 10 });
    expect(r).toEqual({ result: 'ok' });
    expect(updateCall()?.[1]).toEqual([ANON, 4]); // one step, not to 10
  });
});
