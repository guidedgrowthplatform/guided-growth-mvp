import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { advanceStep } = await import('../advanceStep.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('advanceStep — B47 capture guard on self-advancing beats', () => {
  it('refuses to leave state-check (step 6) when record_checkin never fired', async () => {
    // currentStep=6 (arrived at state-check via a prior, legitimate advance),
    // no stateCheck/checkin in data — the exact B47 console shape: submit_profile
    // OK, advance_step OK (1->6, landing on state-check), advance_step OK a
    // second time (6->7) with nothing captured in between.
    pool.query.mockResolvedValueOnce({
      rows: [{ current_step: 6, data: {}, path: null, brain_dump_raw: null }],
    });

    const result = await advanceStep({ anon_id: ANON }, { target_step: 7 });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/state_check_missing/);
    // Only the SELECT ran — the UPDATE never fired, so current_step never moved.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('allows leaving state-check once record_checkin saved stateCheck', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { current_step: 6, data: { stateCheck: { mood: 4 } }, path: null, brain_dump_raw: null },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ current_step: 7 }] });

    const result = await advanceStep({ anon_id: ANON }, { target_step: 7 });

    expect(result.ok).toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('rejects landing on state-check directly from profile as a multi-step skip', async () => {
    // profile(1) -> state-check(6) is a +5 jump, rejected as cannot_skip_steps
    // regardless of data — advance_step only ever moves one beat at a time.
    // Rejected before the UPDATE, so only the SELECT mock is ever consumed.
    pool.query.mockResolvedValueOnce({
      rows: [
        { current_step: 1, data: { age: 28, gender: 'Male' }, path: null, brain_dump_raw: null },
      ],
    });

    const result = await advanceStep({ anon_id: ANON }, { target_step: 6 });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/cannot_skip_steps/);
  });

  it('refuses to leave profile (step 1) when age/gender are still missing', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ current_step: 1, data: {}, path: null, brain_dump_raw: null }],
    });

    const result = await advanceStep({ anon_id: ANON }, { target_step: 2 });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/age_missing/);
  });

  it('back-nav (target <= current) is always allowed regardless of capture state', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ current_step: 6, data: {}, path: null, brain_dump_raw: null }],
      })
      .mockResolvedValueOnce({ rows: [{ current_step: 3 }] });

    const result = await advanceStep({ anon_id: ANON }, { target_step: 3 });

    expect(result.ok).toBe(true);
  });
});
