/**
 * Error-path persistence — covers all 4 sites in api/llm/[...path].ts that
 * call persistChatTurn({ includeAssistant: false }):
 *   - L472  stream-open failure (no stream ever opens)
 *   - L518  mid-iteration throw (stream rejects partway)
 *   - L600  tool_cap reached after MAX_ROUNDS
 *   - L621  outer catch (escape from outside the inner stream try)
 * Each case asserts tool rows persist (with user_turn_id + tool_call_id) and
 * no assistant row is written.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}));
vi.mock('../auth.js', () => ({
  requireUser: vi.fn(),
  setUserContext: vi.fn(),
  handlePreflight: vi.fn(() => false),
}));
vi.mock('../rate-limit.js', () => ({
  checkRateLimit: vi.fn(() => ({ limited: false, retryAfter: 0 })),
}));
vi.mock('../llm/openai.js', () => ({
  getOpenAIKey: vi.fn(() => 'sk-test'),
  OpenAIError: class OpenAIError extends Error {},
}));
vi.mock('../llm/openai-responses.js', () => ({
  openResponsesStream: vi.fn(),
}));
vi.mock('../llm/buildSystemPrompt.js', () => ({
  buildSystemPromptForRequest: vi.fn().mockResolvedValue({
    systemPrompt: 'sys',
    contextVersion: 1,
    deltaCount: 0,
  }),
}));

const pool = (await import('../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};
const auth = await import('../auth.js');
const { openResponsesStream } = await import('../llm/openai-responses.js');
const handler = (await import('../../llm/[...path].js')).default;

function mockRes(opts: { writeThrowsOn?: (chunk: string) => boolean } = {}) {
  const writes: string[] = [];
  let ended = false;
  const res = {
    _status: 200,
    _writes: writes,
    _ended: () => ended,
    status(code: number) {
      this._status = code;
      return this as unknown as VercelResponse;
    },
    json: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: (chunk: string) => {
      if (opts.writeThrowsOn && opts.writeThrowsOn(chunk)) {
        throw new Error('write blew up');
      }
      writes.push(chunk);
      return true;
    },
    end: () => {
      ended = true;
    },
    on: vi.fn(),
  };
  return res as unknown as VercelResponse & {
    _status: number;
    _writes: string[];
    _ended: () => boolean;
  };
}

function mockReq(body: Record<string, unknown>): VercelRequest {
  return {
    method: 'POST',
    query: { '...path': '__index' },
    body,
    headers: {},
    on: vi.fn(),
  } as unknown as VercelRequest;
}

const USER_TURN_ID = '11111111-2222-4333-8444-555555555555';
const CHAT_SESSION_ID = 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee';

function makeClient() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (sql.includes('COALESCE(MAX(turn_index)')) {
        return { rowCount: 1, rows: [{ base: 0 }] };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  return { client, queries };
}

function assertToolRowPersisted(
  queries: Array<{ sql: string; params: unknown[] }>,
  toolCallId: string,
  toolName = 'log_event',
) {
  const toolInsert = queries.find(
    (q) => q.sql.includes('role, content, tool_call_id') && q.sql.includes('user_turn_id'),
  );
  expect(toolInsert, 'tool row insert was issued').toBeDefined();
  if (toolInsert) {
    expect(toolInsert.params).toContain(USER_TURN_ID);
    expect(toolInsert.params).toContain(toolCallId);
    expect(toolInsert.params).toContain(toolName);
  }
  const assistantInsert = queries.find(
    (q) => q.sql.includes("'assistant'") && q.sql.includes('openai_response_id'),
  );
  expect(assistantInsert, 'no assistant row on error path').toBeUndefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    authUserId: 'user-A',
    anonId: 'anon-A',
    firstName: null,
    email: 'a@example.com',
    role: 'user',
    status: 'active',
  });
});

describe('LLM route — error-path tool persistence', () => {
  it('L518 — persists tool row when stream throws mid-iteration', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });

    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-err-1',
        name: 'log_event',
        argumentsRaw: JSON.stringify({ event_name: 'navigate' }),
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 5 };
    }
    async function* gen2() {
      yield { type: 'delta', content: 'partial' };
      throw new Error('boom mid-stream');
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(gen1())
      .mockResolvedValueOnce(gen2());

    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // dedupLookup miss
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'log-row-1', timestamp: new Date() }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    const { client, queries } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-FIRST',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      mockRes(),
    );

    assertToolRowPersisted(queries, 'call-err-1');
  });

  it('L472 — stream-open fails on first try, persistChatTurn called with no tool rows', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });

    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('openai down'),
    );
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    const { client, queries } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-FIRST',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    // No tool rows accumulated → persistChatTurn early-returns without opening a client txn.
    expect(pool.connect).not.toHaveBeenCalled();
    expect(queries.length).toBe(0);
    // Error event was emitted and response ended.
    const writes = (res as unknown as { _writes: string[] })._writes.join('');
    expect(writes).toContain('"type":"error"');
    expect(writes).toContain('openai_error');
  });

  it('L600 — tool_cap reached after MAX_ROUNDS persists all dispatched tool rows', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });

    // Stream factory: every round emits a tool_call. With 5 rounds, persistedToolRows ends at 5.
    function makeGen(roundIdx: number) {
      return (async function* () {
        yield {
          type: 'tool_call',
          callId: `call-cap-${roundIdx}`,
          name: 'log_event',
          argumentsRaw: JSON.stringify({ event_name: 'navigate' }),
        };
        yield { type: 'completed', responseId: `resp-${roundIdx}`, totalTokens: 1 };
      })();
    }
    const openMock = openResponsesStream as unknown as ReturnType<typeof vi.fn>;
    for (let i = 0; i < 5; i++) openMock.mockResolvedValueOnce(makeGen(i));

    // Each round: 1 dedupLookup miss + 1 log_event INSERT into session_log.
    for (let i = 0; i < 5; i++) {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: `log-${i}`, timestamp: new Date() }],
      });
    }
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    const { client, queries } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-FIRST',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    // All 5 tool rows persisted (one INSERT each).
    const toolInserts = queries.filter(
      (q) => q.sql.includes('role, content, tool_call_id') && q.sql.includes('user_turn_id'),
    );
    expect(toolInserts.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      const match = toolInserts.find((q) => q.params.includes(`call-cap-${i}`));
      expect(match, `tool row for round ${i}`).toBeDefined();
      if (match) expect(match.params).toContain(USER_TURN_ID);
    }
    const assistantInsert = queries.find(
      (q) => q.sql.includes("'assistant'") && q.sql.includes('openai_response_id'),
    );
    expect(assistantInsert).toBeUndefined();

    const writes = (res as unknown as { _writes: string[] })._writes.join('');
    expect(writes).toContain('tool_cap_reached');
  });

  it('L621 — outer catch persists round-1 tool row when round-2 res.write throws', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });

    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-outer-1',
        name: 'log_event',
        argumentsRaw: JSON.stringify({ event_name: 'navigate' }),
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 1 };
    }
    async function* gen2() {
      yield {
        type: 'tool_call',
        callId: 'call-outer-2',
        name: 'log_event',
        argumentsRaw: JSON.stringify({ event_name: 'navigate' }),
      };
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(gen1())
      .mockResolvedValueOnce(gen2());

    // Round 1: dedupLookup miss + log_event INSERT.
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'log-1', timestamp: new Date() }],
    });
    // Round 2: dedupLookup miss + log_event INSERT (then send throws).
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'log-2', timestamp: new Date() }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    const { client, queries } = makeClient();
    pool.connect.mockResolvedValue(client);

    // Throw on the SECOND tool_result write so round-1 row is already in persistedToolRows.
    let toolResultWrites = 0;
    const res = mockRes({
      writeThrowsOn: (chunk) => {
        if (!chunk.includes('"type":"tool_result"')) return false;
        toolResultWrites++;
        return toolResultWrites === 2;
      },
    });

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-FIRST',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    // Round-1 tool row must be persisted; round-2 row was never pushed.
    const toolInserts = queries.filter(
      (q) => q.sql.includes('role, content, tool_call_id') && q.sql.includes('user_turn_id'),
    );
    expect(toolInserts.length).toBe(1);
    expect(toolInserts[0].params).toContain('call-outer-1');
    expect(toolInserts[0].params).toContain(USER_TURN_ID);
    const assistantInsert = queries.find(
      (q) => q.sql.includes("'assistant'") && q.sql.includes('openai_response_id'),
    );
    expect(assistantInsert).toBeUndefined();
  });
});

describe('LLM route — dedupLookup short-circuit', () => {
  it('returns cached payload and skips side-effect when (user_turn_id, tool_call_id) already persisted', async () => {
    // owner-row probe
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });
    // writeStartRow INSERT — now runs before the round loop (true start marker).
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-dedup-1',
        name: 'log_event',
        argumentsRaw: JSON.stringify({ event_name: 'navigate' }),
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 1 };
    }
    // Round 2 closes out — no further tool calls.
    async function* gen2() {
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(gen1())
      .mockResolvedValueOnce(gen2());

    // dedupLookup HIT
    const cachedResult = { ok: true, payload: { id: 'log-cached', cached: true } };
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ content: JSON.stringify(cachedResult) }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    const { client, queries } = makeClient();
    // Success-path persistChatTurn dup-check must miss so the assistant row persists.
    client.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (sql.includes('COALESCE(MAX(turn_index)')) {
        return { rowCount: 1, rows: [{ base: 0 }] };
      }
      if (sql.includes('SELECT 1 FROM chat_messages WHERE id')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-FIRST',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    const writes = (res as unknown as { _writes: string[] })._writes.join('');
    expect(writes).toContain('"type":"tool_result"');
    expect(writes).toContain('"cached":true');

    // dedupLookup queried exactly once with the right keys.
    const dedupLookups = pool.query.mock.calls.filter((c) => {
      const sql = c[0] as string;
      return (
        typeof sql === 'string' && sql.includes('WHERE user_turn_id = $1 AND tool_call_id = $2')
      );
    });
    expect(dedupLookups.length).toBe(1);
    expect(dedupLookups[0][1]).toEqual([USER_TURN_ID, 'call-dedup-1']);

    // Only start + end session_log writes — the log_event handler's own INSERT is suppressed.
    const sessionLogInserts = pool.query.mock.calls.filter((c) => {
      const sql = c[0] as string;
      return typeof sql === 'string' && /INSERT\s+INTO\s+session_log/i.test(sql);
    });
    expect(sessionLogInserts.length).toBe(2);

    // Success path still writes assistant + tool rows.
    const assistantInsert = queries.find(
      (q) => q.sql.includes("'assistant'") && q.sql.includes('openai_response_id'),
    );
    expect(assistantInsert).toBeDefined();
    const toolInsert = queries.find(
      (q) => q.sql.includes('role, content, tool_call_id') && q.sql.includes('user_turn_id'),
    );
    expect(toolInsert).toBeDefined();
    if (toolInsert) {
      expect(toolInsert.params).toContain(USER_TURN_ID);
      expect(toolInsert.params).toContain('call-dedup-1');
    }
  });
});

describe('LLM route — onboarding model + fork tool-choice forcing', () => {
  async function* completedOnly() {
    yield { type: 'completed', responseId: 'resp-fork', totalTokens: 1 };
  }

  function firstStreamOpts() {
    return (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      model?: string;
      toolChoice?: unknown;
      tools?: ReadonlyArray<{ name: string }>;
    };
  }

  async function runFork(opts: { path: string | null }) {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ foreign_owned: false, prev_response_id: null }],
      })
      .mockResolvedValueOnce({
        rowCount: opts.path ? 1 : 0,
        rows: opts.path ? [{ path: opts.path }] : [],
      });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      completedOnly(),
    );
    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'ONBOARD-FORK--FORM',
        user_message: "no I haven't",
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      mockRes(),
    );
  }

  it('forces required choice over {submit_path_choice, ask_clarification} on the fork before a path is set', async () => {
    await runFork({ path: null });
    const o = firstStreamOpts();
    expect(o.model).toBe('gpt-4o-mini');
    expect(o.toolChoice).toBe('required');
    expect(o.tools?.map((t) => t.name).sort()).toEqual(['ask_clarification', 'submit_path_choice']);
  });

  it('does NOT force once a path is already saved (so the confirm turn can advance)', async () => {
    await runFork({ path: 'simple' });
    const o = firstStreamOpts();
    expect(o.model).toBe('gpt-4o-mini');
    expect(o.toolChoice).toBeUndefined();
    expect(o.tools?.length ?? 0).toBeGreaterThan(2);
  });

  it('opener with no prior context sends a non-empty input (no empty-array request)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ foreign_owned: false, prev_response_id: null }],
      })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      completedOnly(),
    );
    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'CHAT',
        mode: 'opener',
        chat_session_id: CHAT_SESSION_ID,
      }),
      mockRes(),
    );

    const o = (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      input?: unknown[];
    };
    expect(o.input?.length ?? 0).toBeGreaterThan(0);
  });

  it('check-in / non-onboarding screens keep the default model and never force', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      completedOnly(),
    );
    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-FIRST',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      mockRes(),
    );

    const o = firstStreamOpts();
    expect(o.model).toBeUndefined();
    expect(o.toolChoice).toBeUndefined();
  });
});
