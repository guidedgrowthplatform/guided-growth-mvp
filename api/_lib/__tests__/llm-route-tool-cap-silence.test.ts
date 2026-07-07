/**
 * W_SILENT-FIX — "coach goes silent" (Mint 2026-07-07 bug report), root-caused
 * in gg-spec/docs/video-feedback-runs/Mint-test-and-bug-report-2026-07-07-at-13.17.16/conductor-review.md:
 * a model that keeps re-emitting a tool call the gate/a handler guard rejects
 * (unknown_tool on the wrong beat, checkin_not_grounded, invalid_args, ...)
 * used to burn the whole MAX_ROUNDS budget in silence, because same-turn
 * dedupe only catches an EXACT (name, args) repeat.
 *
 * Covers the two new levers in api/llm/[...path].ts:
 *   - Lever 1: a tool that fails TOOL_FAILURE_BAN_LIMIT times in one turn is
 *     dropped from the tools offered for the rest of the turn (and gated
 *     server-side if the model still names it anyway).
 *   - Lever 2: the final allowed round is always requested text-only
 *     (tool_choice: 'none').
 * The L600 case in llm-route-error-paths.test.ts covers the last-resort
 * fallback-text backstop when a turn still hits the cap.
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

const deferred: Promise<unknown>[] = [];
vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>) => {
    deferred.push(p);
  },
}));
const flushDeferred = async () => {
  await Promise.allSettled(deferred.splice(0));
};

const pool = (await import('../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};
const auth = await import('../auth.js');
const { openResponsesStream } = await import('../llm/openai-responses.js');
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
      if (sql.includes('SELECT 1 FROM chat_messages WHERE id')) {
        return { rowCount: 0, rows: [] }; // never a duplicate in these tests
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  return { client, queries };
}

function toolResultEvents(writes: string): Array<{ id: string; ok: boolean; result: unknown }> {
  return writes
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice('data: '.length)) as Record<string, unknown>)
    .filter((evt) => evt.type === 'tool_result') as unknown as Array<{
    id: string;
    ok: boolean;
    result: unknown;
  }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  deferred.length = 0;
  (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    authUserId: 'user-A',
    anonId: 'anon-A',
    firstName: null,
    email: 'a@example.com',
    role: 'user',
    status: 'active',
  });
  pool.query.mockImplementation(async (sql: string) => {
    if (sql.includes('EXISTS (')) {
      return { rowCount: 1, rows: [{ foreign_owned: false, prev_response_id: null }] };
    }
    // Covers: dedupLookup misses, and the onboarding user/assistant text
    // window queries (neither is needed for record_checkin's grounding
    // guard, which reads ctx.user_text directly).
    if (sql.includes('SELECT content FROM chat_messages')) {
      return { rowCount: 0, rows: [] };
    }
    return { rowCount: 1, rows: [] };
  });
});

// ONBOARD-STATE-CHECK's only real tools are record_checkin + advance_step
// (beatContexts.ts) — the exact beat from the Mint video. A user message with
// no rating digit, no state-check word, and no affirmation fails
// recordCheckin's grounding guard (checkin_not_grounded) WITHOUT ever
// touching the DB, so the same fixed message reliably fails every round.
const UNGROUNDED_MESSAGE = 'I want to schedule my walks for later in the week';

describe('LLM route — tool storm breaker (W_SILENT-FIX)', () => {
  it('lever 1: bans record_checkin after 2 same-turn failures, drops it from later rounds, and the coach recovers with real text instead of hitting the cap', async () => {
    async function* round0() {
      yield {
        type: 'tool_call',
        callId: 'call-0',
        name: 'record_checkin',
        argumentsRaw: JSON.stringify({ mood: 1 }),
      };
      yield { type: 'completed', responseId: 'resp-0', totalTokens: 1 };
    }
    async function* round1() {
      yield {
        type: 'tool_call',
        callId: 'call-1',
        name: 'record_checkin',
        argumentsRaw: JSON.stringify({ mood: 2 }), // distinct args — not a dedupe hit
      };
      yield { type: 'completed', responseId: 'resp-1', totalTokens: 1 };
    }
    // Round 2: the model (implausibly) still names the now-banned tool — the
    // belt-and-suspenders gate must reject it without a 3rd real dispatch.
    async function* round2() {
      yield {
        type: 'tool_call',
        callId: 'call-2',
        name: 'record_checkin',
        argumentsRaw: JSON.stringify({ mood: 3 }),
      };
      yield { type: 'completed', responseId: 'resp-2', totalTokens: 1 };
    }
    // Round 3: the model gives up on the tool and just answers in words.
    async function* round3() {
      yield { type: 'delta', content: "Let's come back to that — what's on your mind right now?" };
      yield { type: 'completed', responseId: 'resp-3', totalTokens: 5 };
    }
    const openMock = openResponsesStream as unknown as ReturnType<typeof vi.fn>;
    openMock
      .mockResolvedValueOnce(round0())
      .mockResolvedValueOnce(round1())
      .mockResolvedValueOnce(round2())
      .mockResolvedValueOnce(round3());

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'ONBOARD-STATE-CHECK',
        user_message: UNGROUNDED_MESSAGE,
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );
    await flushDeferred();

    const writes = (res as unknown as { _writes: string[] })._writes.join('');
    const results = toolResultEvents(writes);

    // Round 0 + round 1: genuine dispatch attempts, both fail on the
    // grounding guard (handler_error / checkin_not_grounded).
    const r0 = results.find((r) => r.id === 'call-0')!;
    const r1 = results.find((r) => r.id === 'call-1')!;
    expect(r0.ok).toBe(false);
    expect((r0.result as { error: string }).error).toBe('handler_error');
    expect(r1.ok).toBe(false);
    expect((r1.result as { error: string }).error).toBe('handler_error');

    // Round 2: the tool is now BANNED — rejected at the gate, a distinct
    // error code from the handler's own rejection, proving it never reached
    // recordCheckin a third time.
    const r2 = results.find((r) => r.id === 'call-2')!;
    expect(r2.ok).toBe(false);
    expect((r2.result as { error: string }).error).toBe('tool_disabled_this_turn');

    // Round 3's real tool request must have excluded record_checkin (lever 1)
    // — only advance_step remains offered.
    const round3Opts = openMock.mock.calls[3][0] as {
      tools?: ReadonlyArray<{ name: string }>;
      toolChoice?: unknown;
    };
    expect(round3Opts.tools?.map((t) => t.name)).toEqual(['advance_step']);

    // The turn recovered with real coach text — never hit tool_cap_reached,
    // never went silent, no generic retry-bubble path needed.
    expect(writes).toContain('"type":"done"');
    expect(writes).not.toContain('tool_cap_reached');
    expect(writes).not.toContain('"type":"error"');
    expect(writes).toContain("Let's come back to that");
  });

  it('lever 2: a healthy multi-round turn is NOT forced text-only before the final round', async () => {
    async function* round0() {
      yield {
        type: 'tool_call',
        callId: 'call-ok-0',
        name: 'advance_step',
        argumentsRaw: JSON.stringify({}),
      };
      yield { type: 'completed', responseId: 'resp-ok-0', totalTokens: 1 };
    }
    async function* round1() {
      yield { type: 'delta', content: 'All set — see you tomorrow.' };
      yield { type: 'completed', responseId: 'resp-ok-1', totalTokens: 3 };
    }
    const openMock = openResponsesStream as unknown as ReturnType<typeof vi.fn>;
    openMock.mockResolvedValueOnce(round0()).mockResolvedValueOnce(round1());

    const { client } = makeClient();
    pool.connect.mockResolvedValue(client);

    const res = mockRes();
    await handler(
      mockReq({
        session_id: 'sess-abcd1234',
        screen_id: 'ONBOARD-STATE-CHECK',
        user_message: 'sounds good, moving on',
        chat_session_id: CHAT_SESSION_ID,
        user_turn_id: USER_TURN_ID,
      }),
      res,
    );
    await flushDeferred();

    const round0Opts = openMock.mock.calls[0][0] as { toolChoice?: unknown };
    const round1Opts = openMock.mock.calls[1][0] as { toolChoice?: unknown };
    expect(round0Opts.toolChoice).toBeUndefined();
    expect(round1Opts.toolChoice).toBeUndefined();

    const writes = (res as unknown as { _writes: string[] })._writes.join('');
    expect(writes).toContain('"type":"done"');
  });
});
