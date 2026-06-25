/**
 * tool_failed emit (D2) + cancelled end-status at the round boundary (F2).
 *   - A WRITE-tool handler_error emits a tool_failed frame alongside tool_result.
 *   - A read-only / invalid tool failure emits tool_result ONLY (no tool_failed).
 *   - clientClosed at the round boundary logs status='cancelled' (not 'error').
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
vi.mock('../llm/checkin/dispatch.js', () => ({
  dispatchCheckinToolCall: vi.fn(),
}));

const pool = (await import('../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};
const auth = await import('../auth.js');
const { openResponsesStream } = await import('../llm/openai-responses.js');
const { dispatchCheckinToolCall } = await import('../llm/checkin/dispatch.js');
const handler = (await import('../../llm/[...path].js')).default;

function mockRes() {
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

function mockReq(body: Record<string, unknown>, onClose?: (cb: () => void) => void): VercelRequest {
  return {
    method: 'POST',
    query: { '...path': '__index' },
    body,
    headers: {},
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'close' && onClose) onClose(cb);
    }),
  } as unknown as VercelRequest;
}

const USER_TURN_ID = '11111111-2222-4333-8444-555555555555';
const CHAT_SESSION_ID = 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee';

function makeClient() {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('COALESCE(MAX(turn_index)')) {
        return { rowCount: 1, rows: [{ base: 0 }] };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  return { client };
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

describe('LLM route — tool_failed emit for WRITE tools', () => {
  it('emits tool_failed alongside tool_result when a write tool throws (handler_error)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-write-1',
        name: 'create_habit',
        argumentsRaw: JSON.stringify({ name: 'meditate' }),
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 5 };
    }
    async function* gen2() {
      yield { type: 'delta', content: 'ok' };
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(gen1())
      .mockResolvedValueOnce(gen2());

    (dispatchCheckinToolCall as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('db exploded'),
    );

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-CHECKIN',
        user_message: 'add meditate',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    const frames = (res as unknown as { _writes: string[] })._writes
      .join('')
      .split('\n\n')
      .filter((b) => b.startsWith('data:'))
      .map((b) => JSON.parse(b.slice(5).trim()));

    const toolResult = frames.find((f) => f.type === 'tool_result');
    expect(toolResult).toMatchObject({ id: 'call-write-1', ok: false });

    const toolFailed = frames.find((f) => f.type === 'tool_failed');
    expect(toolFailed).toMatchObject({
      id: 'call-write-1',
      name: 'create_habit',
      error: 'handler_error',
      message: 'db exploded',
    });
  });

  it('emits tool_failed when update_reflection throws (regression: was missing from MUTATING_TOOLS)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-upd-refl-1',
        name: 'update_reflection',
        argumentsRaw: JSON.stringify({ mode: 'freeform' }),
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 5 };
    }
    async function* gen2() {
      yield { type: 'delta', content: 'ok' };
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(gen1())
      .mockResolvedValueOnce(gen2());

    (dispatchCheckinToolCall as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('reflection save failed'),
    );

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-CHECKIN',
        user_message: 'switch me to freeform journaling',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    const frames = (res as unknown as { _writes: string[] })._writes
      .join('')
      .split('\n\n')
      .filter((b) => b.startsWith('data:'))
      .map((b) => JSON.parse(b.slice(5).trim()));

    expect(frames.find((f) => f.type === 'tool_failed')).toMatchObject({
      id: 'call-upd-refl-1',
      name: 'update_reflection',
      error: 'handler_error',
    });
  });

  it('does NOT emit tool_failed for a read-only tool failure (query_habits)', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-read-1',
        name: 'query_habits',
        argumentsRaw: '{}',
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 1 };
    }
    async function* gen2() {
      yield { type: 'delta', content: 'ok' };
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(gen1())
      .mockResolvedValueOnce(gen2());

    (dispatchCheckinToolCall as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('read blew up'),
    );

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-CHECKIN',
        user_message: 'what are my habits',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );

    const writes = (res as unknown as { _writes: string[] })._writes.join('');
    expect(writes).toContain('"type":"tool_result"');
    expect(writes).not.toContain('"type":"tool_failed"');
  });
});

describe('LLM route — cancelled status at round boundary (F2)', () => {
  it('logs status=cancelled when the client closes between tool rounds', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });

    let closeCb: (() => void) | null = null;

    // Round 1 fires a tool, then triggers the client-close before round 2's
    // boundary check runs.
    async function* gen1() {
      yield {
        type: 'tool_call',
        callId: 'call-cancel-1',
        name: 'log_event',
        argumentsRaw: JSON.stringify({ event_name: 'navigate' }),
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 1 };
      closeCb?.();
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(gen1());

    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // dedupLookup miss
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'log-1', timestamp: new Date() }],
    });

    const endRowPayloads: unknown[] = [];
    pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (
        typeof sql === 'string' &&
        /INSERT\s+INTO\s+session_log/i.test(sql) &&
        params &&
        (params[4] as { phase?: string })?.phase === 'end'
      ) {
        endRowPayloads.push(params[4]);
      }
      return { rowCount: 1, rows: [] };
    });

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq(
        {
          session_id: 'sess-abcd1234',
          screen_id: 'HOME-FIRST',
          user_message: 'hi',
          chat_session_id: CHAT_SESSION_ID,
          user_turn_id: USER_TURN_ID,
        },
        (cb) => {
          closeCb = cb;
        },
      ),
      mockRes(),
    );

    expect(endRowPayloads.length).toBeGreaterThan(0);
    const endRow = endRowPayloads.at(-1) as { status: string; error_code: string | null };
    expect(endRow.status).toBe('cancelled');
    expect(endRow.error_code).toBeNull();
  });
});

describe('LLM route — prior_opener (client-spoken opener)', () => {
  it('prepends the opener as a synthetic assistant turn when no prev_response_id', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: null }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    async function* gen() {
      yield { type: 'output_text_delta', delta: 'ok' };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 1 };
    }
    const streamFn = openResponsesStream as unknown as ReturnType<typeof vi.fn>;
    streamFn.mockResolvedValueOnce(gen());

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'MCHECK-01',
        user_message: 'slept ok',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
        prior_opener: 'Good morning. Ready to check in?',
      }),
      mockRes(),
    );

    const input = streamFn.mock.calls[0][0].input as Array<{ role: string; content: string }>;
    expect(input[0]).toEqual({
      type: 'message',
      role: 'assistant',
      content: 'Good morning. Ready to check in?',
    });
    expect(input[input.length - 1].role).toBe('user');
  });

  it('does NOT prepend when a prev_response_id exists', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ foreign_owned: false, prev_response_id: 'resp-prev' }],
    });
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] });

    async function* gen() {
      yield { type: 'output_text_delta', delta: 'ok' };
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    const streamFn = openResponsesStream as unknown as ReturnType<typeof vi.fn>;
    streamFn.mockResolvedValueOnce(gen());

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'HOME-CHECKIN',
        user_message: 'hi',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
        prior_opener: 'Good morning. Ready to check in?',
      }),
      mockRes(),
    );

    const input = streamFn.mock.calls[0][0].input as Array<{ role: string }>;
    expect(input.every((m) => m.role !== 'assistant')).toBe(true);
  });
});
