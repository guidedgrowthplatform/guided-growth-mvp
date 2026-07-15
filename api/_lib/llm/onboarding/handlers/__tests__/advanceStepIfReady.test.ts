import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { advanceStepIfReady } = await import('../confirmStepComplete.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => vi.clearAllMocks());

describe('advanceStepIfReady', () => {
  it('returns required_missing when the gated field is absent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ data: {}, path: null, current_step: 1 }] });
    const r = await advanceStepIfReady(ANON, 'ONBOARD-01--FORM');
    expect(r).toEqual({ advanced: false, reason: 'required_missing' });
    expect(pool.query).toHaveBeenCalledTimes(1); // no bump when blocked
  });

  it('returns required_missing when only nickname is present (other profile fields missing)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ data: { nickname: 'alice' }, path: null, current_step: 1 }],
    });
    const r = await advanceStepIfReady(ANON, 'ONBOARD-01--FORM');
    expect(r).toEqual({ advanced: false, reason: 'required_missing' });
    expect(pool.query).toHaveBeenCalledTimes(1); // no bump when blocked
  });

  it('bumps and returns current_step when all four profile fields are present', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            data: { nickname: 'alice', age: 28, gender: 'Female', referralSource: 'Reddit' },
            path: null,
            current_step: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ current_step: 2 }] });
    const r = await advanceStepIfReady(ANON, 'ONBOARD-01--FORM');
    expect(r).toEqual({ advanced: true, current_step: 2 });
  });

  it('returns no_next_step for a screen absent from NEXT_STEP', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ data: {}, path: null, current_step: 5 }] });
    const r = await advanceStepIfReady(ANON, 'ONBOARD-RECAP');
    expect(r).toEqual({ advanced: false, reason: 'no_next_step' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('advances ONBOARD-ADVANCED-04 to step 6 when reflectionConfig is present', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ data: { reflectionConfig: { time: '20:00' } }, path: null, current_step: 5 }],
      })
      .mockResolvedValueOnce({ rows: [{ current_step: 6 }] });
    const r = await advanceStepIfReady(ANON, 'ONBOARD-ADVANCED-04');
    expect(r).toEqual({ advanced: true, current_step: 6 });
    expect(pool.query.mock.calls[1][1]).toEqual([ANON, 6]);
  });

  it('blocks ONBOARD-ADVANCED-04 when reflectionConfig is missing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ data: {}, path: null, current_step: 5 }] });
    const r = await advanceStepIfReady(ANON, 'ONBOARD-ADVANCED-04');
    expect(r).toEqual({ advanced: false, reason: 'required_missing' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('runs the GREATEST UPDATE with the screen next-step arg', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ data: {}, path: null, current_step: 3 }] })
      .mockResolvedValueOnce({ rows: [{ current_step: 5 }] });
    await advanceStepIfReady(ANON, 'ONBOARD-ADVANCED-02');
    const update = pool.query.mock.calls[1];
    expect(update[0]).toMatch(/UPDATE onboarding_states SET current_step = GREATEST/);
    expect(update[1]).toEqual([ANON, 5]);
  });
});
