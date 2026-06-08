/**
 * P1-07 — Agent Tool Definitions.
 *
 * Tests the five LLM tools both Vapi (Path 1) and Direct LLM (Path 3) will
 * consume. The exported TOOL_DEFINITIONS array is the wire artifact (pasted
 * into Vapi assistant config, fed to the LLM via SDK tool_choice). The
 * dispatchToolCall function is the runtime entrypoint both paths route
 * through, guaranteeing identical behavior across channels.
 *
 * Handlers are tested with a mocked pg pool. The real integration check
 * ("identical tool_call payload across both paths") lives in P1-11 + P1-15
 * once both callers exist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({
  default: { query: vi.fn() },
}));

const pool = (await import('../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { TOOL_DEFINITIONS, dispatchToolCall } = await import('../tools');

const CTX = { auth_user_id: 'user-A', anon_id: 'anon-A', session_id: 'sess-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TOOL_DEFINITIONS', () => {
  it('exports exactly five tools', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(5);
  });

  it('exposes the canonical tool names', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(names).toEqual([
      'get_user_context',
      'log_entry',
      'log_event',
      'navigate_next',
      'update_profile',
    ]);
  });

  it('every tool has a non-empty description', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('every tool has a valid JSON-Schema parameters object', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeTypeOf('object');
      expect(Array.isArray(tool.parameters.required)).toBe(true);
      expect(tool.parameters.additionalProperties).toBe(false);
    }
  });

  it('get_user_context requires screen_id', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'get_user_context')!;
    expect(tool.parameters.required).toEqual(['screen_id']);
    expect(tool.parameters.properties.screen_id).toMatchObject({ type: 'string' });
  });

  it('update_profile uses an enum field whitelist', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'update_profile')!;
    expect(tool.parameters.required).toEqual(['field', 'value']);
    expect(tool.parameters.properties.field).toMatchObject({
      type: 'string',
      enum: ['name', 'nickname', 'age_group', 'gender', 'referral_source'],
    });
    expect(tool.parameters.properties.value).toMatchObject({ type: 'string' });
  });

  it('navigate_next requires target_screen', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'navigate_next')!;
    expect(tool.parameters.required).toEqual(['target_screen']);
  });

  it('log_event requires event_name', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'log_event')!;
    expect(tool.parameters.required).toEqual(['event_name']);
    expect(tool.parameters.properties.event_name).toMatchObject({ type: 'string' });
  });

  it('wire-shape snapshot — any change must be intentional', () => {
    // This is the P1-07 VERIFY criterion proxy: a stable serialization that
    // both Vapi and Direct LLM consumers will derive from. If this diff is
    // non-empty in a PR, reviewers must confirm both consumers were updated.
    expect(JSON.stringify(TOOL_DEFINITIONS)).toMatchSnapshot();
  });
});

describe('dispatchToolCall — get_user_context', () => {
  it('returns context_block + version for a known screen', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ context_block: 'You are on HOME.', version: 3 }],
    });

    const result = await dispatchToolCall(CTX, 'get_user_context', { screen_id: 'HOME' });

    expect(result).toEqual({
      ok: true,
      result: { screen_id: 'HOME', context_block: 'You are on HOME.', version: 3 },
    });
    const call = pool.query.mock.calls[0];
    expect(call[0]).toMatch(/screen_contexts/);
    expect(call[1]).toEqual(['HOME']);
  });

  it('returns a structured not_found error for an unknown screen', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await dispatchToolCall(CTX, 'get_user_context', { screen_id: 'NOPE' });

    expect(result).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('dispatchToolCall — update_profile', () => {
  it('writes a whitelisted field to profiles scoped to the user', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await dispatchToolCall(CTX, 'update_profile', {
      field: 'nickname',
      value: 'yair',
    });

    expect(result).toEqual({
      ok: true,
      result: { field: 'nickname', value: 'yair' },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE profiles SET nickname/);
    expect(sql).toMatch(/WHERE id = \$1/);
    expect(params).toEqual(['user-A', 'yair']);
  });

  it('rejects a non-whitelisted field with invalid_args', async () => {
    const result = await dispatchToolCall(CTX, 'update_profile', {
      field: 'role',
      value: 'admin',
    });

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('enforces a length cap on the value', async () => {
    const result = await dispatchToolCall(CTX, 'update_profile', {
      field: 'nickname',
      value: 'a'.repeat(300),
    });

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an unsafe nickname (regex same as PATCH endpoint)', async () => {
    const result = await dispatchToolCall(CTX, 'update_profile', {
      field: 'nickname',
      value: 'has spaces',
    });

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('dispatchToolCall — navigate_next', () => {
  it('writes a navigate row to session_log with the source tagged llm_tool', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'evt-1', timestamp: new Date('2026-05-13T12:00:00Z') }],
    });

    const result = await dispatchToolCall(CTX, 'navigate_next', {
      target_screen: 'MCHECK-01',
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      ok: true,
      result: { logged: true, session_log_id: 'evt-1', target_screen: 'MCHECK-01' },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO session_log/);
    expect(params[0]).toBe('anon-A');
    expect(params).toContain('sess-1');
    expect(params).toContain('navigate');
    const payload = params.find(
      (p: unknown) => typeof p === 'object' && p !== null && 'source' in (p as object),
    );
    expect(payload).toMatchObject({ source: 'llm_tool', target_screen: 'MCHECK-01' });
  });
});

describe('dispatchToolCall — log_event', () => {
  it('writes a whitelisted event with optional properties', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'evt-7', timestamp: new Date('2026-05-13T12:00:00Z') }],
    });

    const result = await dispatchToolCall(CTX, 'log_event', {
      event_name: 'habit_completed',
      properties: { habit_id: 'h1' },
    });

    expect(result).toMatchObject({
      ok: true,
      result: { logged: true, session_log_id: 'evt-7' },
    });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toContain('habit_completed');
    expect(params).toContain('sess-1');
  });

  it('rejects events outside the session_log whitelist', async () => {
    const result = await dispatchToolCall(CTX, 'log_event', {
      event_name: 'not_a_real_event',
    });

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects events using the PostHog present-tense aliases', async () => {
    // PostHog uses create_habit; session_log uses habit_added. The tool must
    // route through the session_log whitelist, not PostHog's.
    const result = await dispatchToolCall(CTX, 'log_event', {
      event_name: 'create_habit',
    });

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
  });
});

describe('dispatchToolCall — log_entry', () => {
  it('inserts a user_logs row and returns logged:true', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'log-1' }] });

    const result = await dispatchToolCall({ ...CTX, screen_id: 'HOME-FIRST' }, 'log_entry', {
      content: 'spoke to 3 people today',
      category: 'social',
      kind: 'did',
      structured: { count: 3 },
    });

    expect(result).toMatchObject({ ok: true, result: { logged: true, user_log_id: 'log-1' } });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO user_logs/);
    expect(params[0]).toBe('anon-A');
    expect(params[1]).toBe('spoke to 3 people today');
    expect(params[2]).toBe('social');
    expect(params[3]).toBe('did');
    expect(params[5]).toBe('HOME-FIRST');
  });

  it('accepts minimal args (content only)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'log-2' }] });
    const result = await dispatchToolCall(CTX, 'log_entry', { content: 'ate a lot' });
    expect(result).toMatchObject({ ok: true });
    const [, params] = pool.query.mock.calls[0];
    expect(params[1]).toBe('ate a lot');
    expect(params[2]).toBeNull();
    expect(params[3]).toBeNull();
  });

  it('rejects missing content', async () => {
    const result = await dispatchToolCall(CTX, 'log_entry', {});
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an invalid category', async () => {
    const result = await dispatchToolCall(CTX, 'log_entry', { content: 'test', category: 'bogus' });
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an invalid kind', async () => {
    const result = await dispatchToolCall(CTX, 'log_entry', { content: 'test', kind: 'maybe' });
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects content over 8000 chars', async () => {
    const result = await dispatchToolCall(CTX, 'log_entry', { content: 'x'.repeat(8001) });
    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns cached result on duplicate tool_call_id (dedup guard)', async () => {
    const cached = { ok: true as const, result: { logged: true, user_log_id: 'log-prev' } };
    const ctx = { ...CTX, tool_call_id: 'tc-1', dedupLookup: async () => cached };
    const result = await dispatchToolCall(ctx, 'log_entry', { content: 'spoke to 3 people' });
    expect(result).toEqual(cached);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('dispatchToolCall — error envelope', () => {
  it('returns unknown_tool for an unrecognized tool name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await dispatchToolCall(CTX, 'definitely_not_a_tool' as any, {});

    expect(result).toMatchObject({ ok: false, error: 'unknown_tool' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns invalid_args when required params are missing', async () => {
    const result = await dispatchToolCall(CTX, 'get_user_context', {});

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns invalid_args when params have the wrong type', async () => {
    const result = await dispatchToolCall(CTX, 'get_user_context', { screen_id: 42 });

    expect(result).toMatchObject({ ok: false, error: 'invalid_args' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('propagates ctx.anon_id to handlers — never trusts a body-supplied id', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'x', timestamp: new Date() }],
    });
    const trusted = { auth_user_id: 'user-trusted', anon_id: 'anon-trusted', session_id: 'sess-1' };
    await dispatchToolCall(trusted, 'navigate_next', {
      target_screen: 'HOME',
      anon_id: 'anon-forged',
    } as unknown as { target_screen: string });
    const navParams = pool.query.mock.calls[0][1];
    expect(navParams[0]).toBe('anon-trusted');
    expect(navParams).not.toContain('anon-forged');
  });
});
