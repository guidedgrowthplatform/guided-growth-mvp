/**
 * Security tests for the Vapi navigate_next handler.
 *
 * The handler issues ONLY an INSERT-if-missing via pool.query (no unlocked
 * pre-read), then delegates EVERY decision to advanceStepIfReadyAtomic against
 * one FOR-UPDATE-locked row: back-nav vs forward vs out-of-sequence, source
 * screen, REQUIRED gate, and the write. The gate txn therefore runs for every
 * valid request (incl. back-nav). Forward is exact-next only (target ==
 * locked step + 1), so repeated calls can't chain past unseen screens
 * (double-fire); target > locked+1 is out_of_sequence with no write.
 * target <= locked step is the deliberate non-monotonic back-nav WRITE (plain
 * SET, not GREATEST). The LLM's target_step is never trusted as the forward
 * destination.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// pool.query — used by navigateNext only for the INSERT-if-missing.
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

// navigateNext top-level pool.query sequence is a single INSERT ... ON CONFLICT
// DO NOTHING. No SELECT pre-read anymore — the locked row is read inside the txn.
function seedState() {
  pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // INSERT
}

// advanceStepIfReadyAtomic client sequence (runs for every valid request):
//   BEGIN → SELECT ... FOR UPDATE → (forward UPDATE | back-nav UPDATE | ROLLBACK) → COMMIT
// nextStep set → forward advance (GREATEST UPDATE). backStep set → back-nav
// (plain SET write). neither → gate rolls back (no write).
function gateTxn(
  data: Record<string, unknown> | null,
  path: string | null,
  currentStep: number | null,
  opts?: { nextStep?: number; backStep?: number },
) {
  clientQuery.mockResolvedValueOnce(undefined); // BEGIN
  clientQuery.mockResolvedValueOnce({ rows: [{ data, path, current_step: currentStep }] }); // SELECT FOR UPDATE
  const written = opts?.nextStep ?? opts?.backStep;
  if (written !== undefined) {
    clientQuery.mockResolvedValueOnce({ rows: [{ current_step: written }] }); // UPDATE
    clientQuery.mockResolvedValueOnce(undefined); // COMMIT
  } else {
    clientQuery.mockResolvedValueOnce(undefined); // ROLLBACK
  }
}

function greatestUpdateCall() {
  return clientQuery.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
}

function plainUpdateCall() {
  return clientQuery.mock.calls.find(
    (c) => String(c[0]).includes('SET current_step') && !String(c[0]).includes('GREATEST'),
  );
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
    it(`rejects: ${c.name} — LLM asks for the exact-next step but data missing`, async () => {
      seedState();
      // target == step + 1 → forward gate runs; blocks (no write).
      gateTxn(c.data, c.path, c.step);
      const r = await navigateNext({ anon_id: ANON, target_step: c.step + 1 });
      expect(r).toMatchObject({ error: expect.stringContaining('no_advance') });
      expect(greatestUpdateCall()).toBeUndefined();
      expect(clientRelease).toHaveBeenCalled();
    });
  }
});

describe('navigate_next — out-of-sequence forward jumps are rejected', () => {
  it('target = step + 2 is out_of_sequence, no write', async () => {
    seedState();
    gateTxn({ nickname: 'a', age: 20, gender: 'x', referralSource: 'y' }, null, 1);
    const r = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(r).toMatchObject({ error: expect.stringContaining('out_of_sequence') });
    expect(greatestUpdateCall()).toBeUndefined();
    expect(plainUpdateCall()).toBeUndefined();
  });

  it('a far forward jump (target 10 from step 3) is out_of_sequence, no write', async () => {
    seedState();
    gateTxn({ category: 'Sleep better' }, 'simple', 3);
    const r = await navigateNext({ anon_id: ANON, target_step: 10 });
    expect(r).toMatchObject({ error: expect.stringContaining('out_of_sequence') });
    expect(greatestUpdateCall()).toBeUndefined();
  });

  it('double-fire chain-skip exploit: after landing on step 4, a duplicate target 10 is rejected', async () => {
    // First call: step 3 braindump → advances to 4.
    seedState();
    gateTxn({ brainDumpText: 'I want to sleep better' }, 'braindump', 3, { nextStep: 4 });
    const first = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(first).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 4]);

    // Duplicate fire now lands on step 4; target 10 is > locked+1 → out_of_sequence.
    vi.clearAllMocks();
    seedState();
    gateTxn({ brainDumpText: 'I want to sleep better' }, 'braindump', 4);
    const second = await navigateNext({ anon_id: ANON, target_step: 10 });
    expect(second).toMatchObject({ error: expect.stringContaining('out_of_sequence') });
    expect(greatestUpdateCall()).toBeUndefined(); // no second advance
  });
});

describe('navigate_next — legitimate advance passes', () => {
  it('step 1 → 2 when all four profile fields present', async () => {
    const data = { nickname: 'alice', age: 28, gender: 'Female', referralSource: 'Reddit' };
    seedState();
    gateTxn(data, null, 1, { nextStep: 2 });
    const r = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 2]);
  });

  it('step 4 advanced → 5 (ADVANCED-02 has no REQUIRED gate — parity with direct lane)', async () => {
    seedState();
    gateTxn({}, 'braindump', 4, { nextStep: 5 });
    const r = await navigateNext({ anon_id: ANON, target_step: 5 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 5]);
  });

  it('step 2 → 3 when path chosen (fork keys off path column)', async () => {
    seedState();
    gateTxn({}, 'simple', 2, { nextStep: 3 });
    const r = await navigateNext({ anon_id: ANON, target_step: 3 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 3]);
  });

  it('step 3 advanced → 4 when braindump present', async () => {
    seedState();
    gateTxn({ brainDumpText: 'I want to sleep better' }, 'braindump', 3, { nextStep: 4 });
    const r = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 4]);
  });

  it('step 5 advanced → 6 when reflectionConfig present (ADVANCED-04 gate)', async () => {
    seedState();
    gateTxn(
      { brainDumpText: 'x', reflectionConfig: { days: [1], prompts: ['a'] } },
      'braindump',
      5,
      { nextStep: 6 },
    );
    const r = await navigateNext({ anon_id: ANON, target_step: 6 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 6]);
  });

  it('step 5 advanced → 6 via custom-prompts (ONBOARD-ADV-CUSTOM gate)', async () => {
    // customPrompts present and no reflectionConfig → source resolves to
    // ONBOARD-ADV-CUSTOM, whose REQUIRED (non-empty customPrompts) is satisfied.
    seedState();
    gateTxn({ brainDumpText: 'x', customPrompts: ['a'] }, 'braindump', 5, { nextStep: 6 });
    const r = await navigateNext({ anon_id: ANON, target_step: 6 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 6]);
  });

  it('step 5 advanced with neither reflectionConfig nor customPrompts → ADVANCED-04 required_missing', async () => {
    // No customPrompts → source resolves to ONBOARD-ADVANCED-04, which needs
    // reflectionConfig; absent → gate blocks.
    seedState();
    gateTxn({ brainDumpText: 'x' }, 'braindump', 5);
    const r = await navigateNext({ anon_id: ANON, target_step: 6 });
    expect(r).toMatchObject({ error: expect.stringContaining('required_missing') });
    expect(greatestUpdateCall()).toBeUndefined();
  });
});

describe('navigate_next — backward / lateral is a non-monotonic write', () => {
  it('back-nav: persisted 5, target 1 → plain SET write of [ANON, 1] (no GREATEST)', async () => {
    seedState();
    gateTxn(null, 'braindump', 5, { backStep: 1 });
    const r = await navigateNext({ anon_id: ANON, target_step: 1 });
    expect(r).toEqual({ result: 'ok' });
    const write = plainUpdateCall();
    expect(write?.[1]).toEqual([ANON, 1]);
    expect(String(write?.[0])).not.toContain('GREATEST');
    expect(greatestUpdateCall()).toBeUndefined();
  });

  it('lateral: target == persisted step → plain SET write of the same value', async () => {
    seedState();
    gateTxn(null, 'braindump', 5, { backStep: 5 });
    const r = await navigateNext({ anon_id: ANON, target_step: 5 });
    expect(r).toEqual({ result: 'ok' });
    const write = plainUpdateCall();
    expect(write?.[1]).toEqual([ANON, 5]);
    expect(String(write?.[0])).not.toContain('GREATEST');
  });
});

describe('navigate_next — edge rows', () => {
  it('missing DB row: SELECT FOR UPDATE empty → step defaults to 1, gates on ONBOARD-01--FORM', async () => {
    seedState();
    // Atomic txn reads an empty locked row → step 1 / ONBOARD-01--FORM;
    // profile complete → advances to 2.
    gateTxn({ nickname: 'a', age: 20, gender: 'x', referralSource: 'y' }, null, null, {
      nextStep: 2,
    });
    const r = await navigateNext({ anon_id: ANON, target_step: 2 });
    expect(r).toEqual({ result: 'ok' });
    expect(greatestUpdateCall()?.[1]).toEqual([ANON, 2]);
  });

  it('null path at step >= 3: no source screen → no_advance, no UPDATE', async () => {
    seedState();
    // path null at step 3 → sourceScreenForStep returns undefined; gate rolls
    // back with no_source_screen.
    gateTxn({ category: 'Sleep' }, null, 3);
    const r = await navigateNext({ anon_id: ANON, target_step: 4 });
    expect(r).toMatchObject({ error: expect.stringContaining('no_source_screen') });
    expect(greatestUpdateCall()).toBeUndefined();
  });
});
