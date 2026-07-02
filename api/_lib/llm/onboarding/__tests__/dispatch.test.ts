import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};
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
    // DATA ONLY: profile UPDATE no longer bumps current_step.
    expect(sql).not.toMatch(/current_step = GREATEST/);
  });

  it('routes advance_step through to the handler', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            current_step: 3,
            data: { category: 'Sleep better' },
            path: 'simple',
            brain_dump_raw: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ current_step: 4 }] });
    const result = await dispatchOnboardingToolCall(
      'advance_step',
      { target_step: 4 },
      { anon_id: ANON },
    );
    expect(result).toMatchObject({ ok: true, result: { current_step: 4 } });
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

  // Card-fill write path per previously-broken beat: tool -> onboarding_states.
  it('routes record_checkin to an onboarding_states write', async () => {
    const result = await dispatchOnboardingToolCall(
      'record_checkin',
      { sleep: 4, mood: 3, energy: 5, stress: 2 },
      { anon_id: ANON },
    );
    expect(result.ok).toBe(true);
    expect(pool.query.mock.calls[0][0] as string).toMatch(/onboarding_states/);
  });

  it('routes submit_morning_checkin to an onboarding_states write with the schedule', async () => {
    const result = await dispatchOnboardingToolCall(
      'submit_morning_checkin',
      { time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], reminder: true, schedule: 'Every day' },
      { anon_id: ANON },
    );
    expect(result.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/onboarding_states/);
    expect(JSON.stringify(params)).toContain('08:00');
  });

  it('routes add_habit to an onboarding_states write', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (/INSERT INTO onboarding_states/.test(sql)) {
          return { rowCount: 1, rows: [{ data: {}, current_step: 5 }] };
        }
        return { rowCount: 1, rows: [{ hc: {} }] };
      }),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(client);
    const result = await dispatchOnboardingToolCall(
      'add_habit',
      {
        name: 'Walking',
        days: [0, 1, 2, 3, 4, 5, 6],
        time: '21:30',
        reminder: true,
        schedule: 'Every day',
      },
      { anon_id: ANON },
    );
    expect(result.ok).toBe(true);
    expect(client.query.mock.calls.some((c) => /onboarding_states/.test(c[0] as string))).toBe(
      true,
    );
  });

  it('routes update_habit to a merge write when the habit exists', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ hc: { Walking: { time: '09:00' } }, current_step: 6 }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ data: {}, current_step: 6 }] });
    const result = await dispatchOnboardingToolCall(
      'update_habit',
      { name: 'Walking', time: '08:00' },
      { anon_id: ANON },
    );
    expect(result.ok).toBe(true);
    const [sql, params] = pool.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE onboarding_states/);
    expect(JSON.stringify(params)).toContain('08:00');
  });

  it('routes submit_custom_prompts to an onboarding_states write with the prompt list', async () => {
    const result = await dispatchOnboardingToolCall(
      'submit_custom_prompts',
      { prompts: ['What went well?', 'What drained you?'] },
      { anon_id: ANON },
    );
    expect(result.ok).toBe(true);
    const writeCall = pool.query.mock.calls.find(
      (c) =>
        /onboarding_states/.test(c[0] as string) &&
        JSON.stringify(c[1]).includes('What went well?'),
    );
    expect(writeCall).toBeDefined();
  });
});
