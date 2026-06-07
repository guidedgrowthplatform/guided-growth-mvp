/**
 * Server-side deterministic onboarding advance — the no-tool exit branch in
 * api/llm/[...path].ts fires confirm_step_complete on a bare affirmation when
 * the model emitted zero tools all turn. Covers: bump+synthetic-send, required
 * missing (no send), real-tool turn (branch skipped), opener mode (no fire).
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

const USER_TURN_ID = '11111111-2222-4333-8444-555555555555';
const CHAT_SESSION_ID = 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee';

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
  return res as unknown as VercelResponse & { _writes: string[] };
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

function makeClient() {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('COALESCE(MAX(turn_index)')) return { rowCount: 1, rows: [{ base: 0 }] };
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  return client;
}

function noToolStream() {
  return (async function* () {
    yield { type: 'delta', content: 'ok' };
    yield { type: 'completed', responseId: 'resp-1', totalTokens: 3 };
  })();
}

// Content-routed pool.query — order-independent (a session_log INSERT lands
// between the ownerRow SELECT and advanceStepIfReady).
function routeQueries(stateRow: Record<string, unknown> | null) {
  pool.query.mockImplementation(async (sql: string) => {
    if (sql.includes('foreign_owned')) {
      return { rowCount: 1, rows: [{ foreign_owned: false, prev_response_id: null }] };
    }
    if (sql.includes('SELECT data, path, current_step')) {
      return { rowCount: stateRow ? 1 : 0, rows: stateRow ? [stateRow] : [] };
    }
    if (sql.includes('GREATEST')) {
      return { rowCount: 1, rows: [{ current_step: 2 }] };
    }
    return { rowCount: 1, rows: [] };
  });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    session_id: 'sess-abcd1234',
    screen_id: 'ONBOARD-01--FORM',
    user_message: 'yes',
    chat_session_id: CHAT_SESSION_ID,
    user_turn_id: USER_TURN_ID,
    ...overrides,
  };
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
  pool.connect.mockResolvedValue(makeClient());
});

describe('LLM route — affirmation deterministic advance', () => {
  it('bumps and emits a synthetic confirm_step_complete on a satisfied required screen', async () => {
    routeQueries({
      data: { nickname: 'Sam', age: 28, gender: 'Female', referralSource: 'Reddit' },
      path: null,
      current_step: 1,
    });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      noToolStream(),
    );

    const res = mockRes();
    await handler(mockReq(baseBody()), res);

    const writes = res._writes.join('');
    expect(writes).toContain('srv-confirm-anon-A-ONBOARD-01--FORM');
    expect(writes).toContain('"name":"confirm_step_complete"');
    expect(writes).toContain('"advance":true');
    expect(writes).toContain('"current_step":2');
    const updateCall = pool.query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    expect(updateCall?.[1]).toEqual(['anon-A', 2]);

    const callId = writes.match(/"type":"tool_call","id":"(srv-confirm-[^"]+)"/)?.[1];
    const resultId = writes.match(/"type":"tool_result","id":"(srv-confirm-[^"]+)"/)?.[1];
    expect(callId).toBeTruthy();
    expect(resultId).toBe(callId);
  });

  it('does not advance on a negation ("no")', async () => {
    routeQueries({ data: { nickname: 'Sam' }, path: null, current_step: 1 });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      noToolStream(),
    );

    const res = mockRes();
    await handler(mockReq(baseBody({ user_message: 'no thanks' })), res);

    expect(res._writes.join('')).not.toContain('srv-confirm');
    expect(pool.query.mock.calls.some((c) => String(c[0]).includes('GREATEST'))).toBe(false);
  });

  it('does not advance on a bare "yes" on a multi-item screen', async () => {
    routeQueries({ data: { goals: ['Walk'] }, path: null, current_step: 4 });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      noToolStream(),
    );

    const res = mockRes();
    await handler(
      mockReq(baseBody({ screen_id: 'ONBOARD-BEGINNER-02', user_message: 'yes' })),
      res,
    );

    expect(res._writes.join('')).not.toContain('srv-confirm');
    expect(pool.query.mock.calls.some((c) => String(c[0]).includes('GREATEST'))).toBe(false);
  });

  it('does not advance on an additive reply on a multi-item screen', async () => {
    routeQueries({ data: { goals: ['Walk'] }, path: null, current_step: 4 });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      noToolStream(),
    );

    const res = mockRes();
    await handler(
      mockReq(baseBody({ screen_id: 'ONBOARD-BEGINNER-02', user_message: 'yes add more' })),
      res,
    );

    expect(res._writes.join('')).not.toContain('srv-confirm');
    expect(pool.query.mock.calls.some((c) => String(c[0]).includes('GREATEST'))).toBe(false);
  });

  it('does not bump or emit when the required field is missing', async () => {
    routeQueries({ data: {}, path: null, current_step: 1 });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      noToolStream(),
    );

    const res = mockRes();
    await handler(mockReq(baseBody()), res);

    const writes = res._writes.join('');
    expect(writes).not.toContain('srv-confirm');
    expect(pool.query.mock.calls.some((c) => String(c[0]).includes('GREATEST'))).toBe(false);
  });

  it('skips the affirmation branch when the model emitted a real tool this turn', async () => {
    routeQueries({ data: { nickname: 'Sam' }, path: null, current_step: 1 });

    function withTool() {
      return (async function* () {
        yield {
          type: 'tool_call',
          callId: 'call-real-1',
          name: 'update_profile',
          argumentsRaw: JSON.stringify({ nickname: 'Sam' }),
        };
        yield { type: 'completed', responseId: 'resp-1', totalTokens: 4 };
      })();
    }
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(withTool())
      .mockResolvedValueOnce(noToolStream());

    const res = mockRes();
    await handler(mockReq(baseBody()), res);

    expect(pool.query.mock.calls.some((c) => String(c[0]).includes('GREATEST'))).toBe(false);
    expect(res._writes.join('')).not.toContain('srv-confirm');
  });

  it('never fires in opener mode', async () => {
    routeQueries({ data: { nickname: 'Sam' }, path: null, current_step: 1 });
    (openResponsesStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      noToolStream(),
    );

    const res = mockRes();
    await handler(mockReq(baseBody({ mode: 'opener', user_message: undefined })), res);

    expect(pool.query.mock.calls.some((c) => String(c[0]).includes('GREATEST'))).toBe(false);
    expect(res._writes.join('')).not.toContain('srv-confirm');
  });
});
