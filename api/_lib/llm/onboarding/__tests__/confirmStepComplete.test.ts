import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { confirmStepComplete } = await import('../handlers/confirmStepComplete.js');

const ANON = '11111111-1111-4111-8111-111111111111';

function row(data: Record<string, unknown> | null, path: string | null = null) {
  pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ data, path }] });
}

beforeEach(() => vi.clearAllMocks());

describe('confirm_step_complete', () => {
  it('advances on an unmapped screen without reading the row', async () => {
    const r = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-ADVANCED-02' }, {});
    expect(r).toEqual({ ok: true, result: { advance: true } });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('advances when no screen_id is supplied', async () => {
    const r = await confirmStepComplete({ anon_id: ANON }, {});
    expect(r).toMatchObject({ ok: true, result: { advance: true } });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('blocks advance when the required field is missing', async () => {
    row({});
    const r = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-01--FORM' }, {});
    expect(r).toMatchObject({ ok: true, result: { advance: false } });
  });

  it('advances when nickname is present', async () => {
    row({ nickname: 'alice' });
    const r = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-01--FORM' }, {});
    expect(r).toMatchObject({ ok: true, result: { advance: true } });
  });

  it('fork advance keys off the path column, not data', async () => {
    row({}, 'simple');
    const r = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-FORK--FORM' }, {});
    expect(r).toMatchObject({ ok: true, result: { advance: true } });
  });

  it('goals require a non-empty array', async () => {
    row({ goals: [] });
    const blocked = await confirmStepComplete(
      { anon_id: ANON, screen_id: 'ONBOARD-BEGINNER-02' },
      {},
    );
    expect(blocked).toMatchObject({ result: { advance: false } });
    row({ goals: ['Walk more'] });
    const ok = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-BEGINNER-02' }, {});
    expect(ok).toMatchObject({ result: { advance: true } });
  });

  it('habit screen requires at least one habitConfig', async () => {
    row({ habitConfigs: {} });
    const blocked = await confirmStepComplete(
      { anon_id: ANON, screen_id: 'ONBOARD-BEGINNER-03' },
      {},
    );
    expect(blocked).toMatchObject({ result: { advance: false } });
    expect(pool.query).toHaveBeenCalledTimes(1); // no bump when blocked
    row({ habitConfigs: { Walk: {} } }); // SELECT
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ current_step: 6 }] }); // UPDATE bump
    const ok = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-BEGINNER-03' }, {});
    expect(ok).toMatchObject({ result: { advance: true, current_step: 6 } });
  });

  it('habit confirm bumps current_step to 6 so useAgentNavigation advances', async () => {
    row({ habitConfigs: { Walk: {} } });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ current_step: 6 }] });
    await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-BEGINNER-03' }, {});
    const update = pool.query.mock.calls[1];
    expect(update[0]).toMatch(/UPDATE onboarding_states SET current_step = GREATEST/);
    expect(update[1]).toEqual([ANON, 6]);
  });

  // Drift guard: locks the set of screens whose advance is gated on a required field.
  it('gates exactly the expected mapped screens, leaving recap/blank-journal ungated', async () => {
    const MAPPED = [
      'ONBOARD-01--FORM',
      'ONBOARD-FORK--FORM',
      'ONBOARD-BEGINNER-01',
      'ONBOARD-BEGINNER-02',
      'ONBOARD-BEGINNER-03',
      'ONBOARD-BEGINNER-07',
      'ONBOARD-ADVANCED',
      'ONBOARD-ADVANCED-04',
    ].sort();

    for (const screen_id of MAPPED) {
      row({}, null);
      const r = await confirmStepComplete({ anon_id: ANON, screen_id }, {});
      expect(r, `${screen_id} should gate on a missing field`).toMatchObject({
        result: { advance: false },
      });
    }

    // Representative unmapped screen advances unconditionally, no row read.
    vi.clearAllMocks();
    const recap = await confirmStepComplete(
      { anon_id: ANON, screen_id: 'ONBOARD-ADVANCED-02' },
      {},
    );
    expect(recap).toMatchObject({ result: { advance: true } });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('blocks advance when the row is absent entirely', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await confirmStepComplete({ anon_id: ANON, screen_id: 'ONBOARD-ADVANCED' }, {});
    expect(r).toMatchObject({ result: { advance: false } });
  });
});
