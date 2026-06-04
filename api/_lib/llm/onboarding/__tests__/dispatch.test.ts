import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { dispatchOnboardingToolCall } = await import('../dispatch.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue({ rowCount: 1, rows: [{ data: {}, current_step: 2 }] });
});

describe('dispatchOnboardingToolCall', () => {
  it('refuses when anon_id is missing', async () => {
    const result = await dispatchOnboardingToolCall(
      'submit_profile',
      { nickname: 'a' },
      {
        anon_id: undefined,
      },
    );
    expect(result).toEqual({
      ok: false,
      error: 'invalid_args',
      message: 'missing anon_id',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses when anon_id is empty string', async () => {
    const result = await dispatchOnboardingToolCall(
      'submit_profile',
      { nickname: 'a' },
      {
        anon_id: '',
      },
    );
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses unknown tool names', async () => {
    const result = await dispatchOnboardingToolCall('not_a_tool', {}, { anon_id: ANON });
    expect(result).toMatchObject({ ok: false, error: 'unknown_tool' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses non-object args', async () => {
    const result = await dispatchOnboardingToolCall('submit_profile', 'not-an-object' as unknown, {
      anon_id: ANON,
    });
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('refuses null args', async () => {
    const result = await dispatchOnboardingToolCall('submit_profile', null as unknown, {
      anon_id: ANON,
    });
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('refuses array args', async () => {
    const result = await dispatchOnboardingToolCall('submit_profile', [], {
      anon_id: ANON,
    });
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('routes valid submit_profile through to handler', async () => {
    const result = await dispatchOnboardingToolCall(
      'submit_profile',
      { nickname: 'alice' },
      { anon_id: ANON },
    );
    expect(result.ok).toBe(true);
    expect(pool.query).toHaveBeenCalled();
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toMatch(/onboarding_states/);
    expect(sql).toMatch(/GREATEST/);
  });

  it('routes confirm_step_complete without touching the DB', async () => {
    const result = await dispatchOnboardingToolCall('confirm_step_complete', {}, { anon_id: ANON });
    expect(result).toEqual({ ok: true, result: { advance: true } });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('routes ask_clarification without touching the DB and echoes the message', async () => {
    const result = await dispatchOnboardingToolCall(
      'ask_clarification',
      { message: '  Would you like step-by-step, or do you have a list?  ' },
      { anon_id: ANON },
    );
    expect(result).toEqual({
      ok: true,
      result: { message: 'Would you like step-by-step, or do you have a list?' },
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects ask_clarification with an empty message', async () => {
    const result = await dispatchOnboardingToolCall(
      'ask_clarification',
      { message: '   ' },
      { anon_id: ANON },
    );
    expect(result).toMatchObject({ ok: false });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('propagates handler exceptions for the caller to wrap', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      dispatchOnboardingToolCall('submit_profile', { nickname: 'alice' }, { anon_id: ANON }),
    ).rejects.toThrow('connection lost');
  });
});
