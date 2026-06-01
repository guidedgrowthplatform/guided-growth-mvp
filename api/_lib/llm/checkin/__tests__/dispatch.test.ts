import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { dispatchCheckinToolCall } = await import('../dispatch.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue({ rowCount: 1, rows: [{ sleep: 3, mood: null, energy: null, stress: null }] });
});

describe('dispatchCheckinToolCall', () => {
  it('refuses when anon_id is missing', async () => {
    const r = await dispatchCheckinToolCall('record_checkin', { sleep: 3 }, { anon_id: undefined });
    expect(r).toEqual({ ok: false, error: 'invalid_args', message: 'missing anon_id' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses when anon_id is empty string', async () => {
    const r = await dispatchCheckinToolCall('record_checkin', { sleep: 3 }, { anon_id: '' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses unknown tool names', async () => {
    const r = await dispatchCheckinToolCall('not_a_tool', {}, { anon_id: ANON });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('refuses non-object args', async () => {
    const r = await dispatchCheckinToolCall('record_checkin', 'nope' as unknown, { anon_id: ANON });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('refuses null args', async () => {
    const r = await dispatchCheckinToolCall('record_checkin', null as unknown, { anon_id: ANON });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('refuses array args', async () => {
    const r = await dispatchCheckinToolCall('record_checkin', [], { anon_id: ANON });
    expect(r).toMatchObject({ ok: false, error: 'invalid_args' });
  });

  it('routes a valid call through to the handler', async () => {
    const r = await dispatchCheckinToolCall('record_checkin', { sleep: 3 }, { anon_id: ANON });
    expect(r.ok).toBe(true);
    expect(pool.query).toHaveBeenCalled();
    expect(pool.query.mock.calls[0][0] as string).toMatch(/INSERT INTO daily_checkins/);
  });

  it('returns the cached dedup result without querying', async () => {
    const cached = { ok: true as const, result: { created: true } };
    const r = await dispatchCheckinToolCall(
      'create_metric',
      { name: 'weight' },
      { anon_id: ANON, tool_call_id: 'tc-1', dedupLookup: async () => cached },
    );
    expect(r).toBe(cached);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('propagates handler exceptions for the caller to wrap', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      dispatchCheckinToolCall('record_checkin', { sleep: 3 }, { anon_id: ANON }),
    ).rejects.toThrow('connection lost');
  });

  describe('timezone threading', () => {
    afterEach(() => vi.useRealTimers());

    it('resolves the date in the forwarded tz, not server UTC', async () => {
      vi.useFakeTimers();
      // 04:30 UTC = prior day 21:30 in America/Los_Angeles (UTC-7).
      vi.setSystemTime(new Date('2026-06-02T04:30:00Z'));
      await dispatchCheckinToolCall(
        'record_checkin',
        { sleep: 3 },
        { anon_id: ANON, timezone: 'America/Los_Angeles' },
      );
      const params = pool.query.mock.calls[0][1] as unknown[];
      expect(params[1]).toBe('2026-06-01'); // local day, not UTC's 2026-06-02
    });
  });
});
