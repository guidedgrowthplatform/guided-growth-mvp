import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  default: { query: vi.fn() },
}));

const pool = (await import('../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { dispatchToolCall } = await import('../llm/tools');

const BASE_CTX = { auth_user_id: 'user-A', anon_id: 'anon-A', session_id: 'sess-1' };
const CACHED = { ok: true as const, result: { cached: true } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tool dedup', () => {
  it('update_profile short-circuits on cached result', async () => {
    const dedupLookup = vi.fn().mockResolvedValue(CACHED);
    const res = await dispatchToolCall(
      { ...BASE_CTX, user_turn_id: 'turn-1', tool_call_id: 'call-1', dedupLookup },
      'update_profile',
      { field: 'name', value: 'Pat' },
    );
    expect(res).toEqual(CACHED);
    expect(dedupLookup).toHaveBeenCalledWith('call-1');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('navigate_next short-circuits on cached result', async () => {
    const dedupLookup = vi.fn().mockResolvedValue(CACHED);
    const res = await dispatchToolCall(
      { ...BASE_CTX, user_turn_id: 'turn-1', tool_call_id: 'call-2', dedupLookup },
      'navigate_next',
      { target_screen: 'HOME-FIRST' },
    );
    expect(res).toEqual(CACHED);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('log_event short-circuits on cached result', async () => {
    const dedupLookup = vi.fn().mockResolvedValue(CACHED);
    const res = await dispatchToolCall(
      { ...BASE_CTX, user_turn_id: 'turn-1', tool_call_id: 'call-3', dedupLookup },
      'log_event',
      { event_name: 'navigate' },
    );
    expect(res).toEqual(CACHED);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('get_user_context does NOT short-circuit even with dedupLookup', async () => {
    const dedupLookup = vi.fn().mockResolvedValue(CACHED);
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ context_block: 'ctx', version: 1 }],
    });
    const res = await dispatchToolCall(
      { ...BASE_CTX, user_turn_id: 'turn-1', tool_call_id: 'call-4', dedupLookup },
      'get_user_context',
      { screen_id: 'HOME-FIRST' },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.context_block).toBe('ctx');
    expect(dedupLookup).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('null lookup → tool proceeds normally', async () => {
    const dedupLookup = vi.fn().mockResolvedValue(null);
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'log-1', timestamp: new Date() }] });
    const res = await dispatchToolCall(
      { ...BASE_CTX, user_turn_id: 'turn-1', tool_call_id: 'call-5', dedupLookup },
      'log_event',
      { event_name: 'navigate' },
    );
    expect(res.ok).toBe(true);
    expect(dedupLookup).toHaveBeenCalledWith('call-5');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('no dedupLookup → tool proceeds normally (update_profile)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const res = await dispatchToolCall(BASE_CTX, 'update_profile', {
      field: 'name',
      value: 'Pat',
    });
    expect(res.ok).toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
