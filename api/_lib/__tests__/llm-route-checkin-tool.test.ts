/**
 * POST /api/llm/checkin-tool — tap-driven record_checkin.
 *   - dispatches record_checkin and maps ok -> 200
 *   - rejects a non-allowlisted toolName with 400 (never dispatches)
 *   - maps invalid_args -> 400, handler_error -> 500
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));
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
vi.mock('../llm/openai-responses.js', () => ({ openResponsesStream: vi.fn() }));
vi.mock('../llm/buildSystemPrompt.js', () => ({
  buildSystemPromptForRequest: vi.fn(),
}));
vi.mock('../llm/checkin/dispatch.js', () => ({ dispatchCheckinToolCall: vi.fn() }));

const auth = await import('../auth.js');
const { dispatchCheckinToolCall } = await import('../llm/checkin/dispatch.js');
const handler = (await import('../../llm/[...path].js')).default;
const dispatch = dispatchCheckinToolCall as unknown as ReturnType<typeof vi.fn>;

function mockRes() {
  const res = {
    _status: 200,
    _json: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this as unknown as VercelResponse;
    },
    json(payload: unknown) {
      this._json = payload;
      return this as unknown as VercelResponse;
    },
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  return res as unknown as VercelResponse & { _status: number; _json: unknown };
}

function mockReq(body: Record<string, unknown>): VercelRequest {
  return {
    method: 'POST',
    query: { '...path': 'checkin-tool' },
    body,
    headers: {},
    on: vi.fn(),
  } as unknown as VercelRequest;
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

describe('POST /api/llm/checkin-tool', () => {
  it('dispatches record_checkin and returns 200', async () => {
    dispatch.mockResolvedValue({
      ok: true,
      result: { recorded: true, date: '2026-06-28', checkin: { sleep: 4, mood: 3 } },
    });
    const res = mockRes();
    await handler(
      mockReq({
        toolName: 'record_checkin',
        args: { sleep: 4, mood: 3 },
        timezone: 'America/New_York',
      }),
      res,
    );
    expect(dispatch).toHaveBeenCalledWith(
      'record_checkin',
      { sleep: 4, mood: 3 },
      {
        anon_id: 'anon-A',
        timezone: 'America/New_York',
      },
    );
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true });
  });

  it('rejects a non-allowlisted toolName with 400 and never dispatches', async () => {
    const res = mockRes();
    await handler(mockReq({ toolName: 'delete_habit', args: { name: 'x' } }), res);
    expect(dispatch).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  it('maps invalid_args -> 400', async () => {
    dispatch.mockResolvedValue({ ok: false, error: 'invalid_args', message: 'sleep must be 1-5' });
    const res = mockRes();
    await handler(mockReq({ toolName: 'record_checkin', args: { sleep: 9 } }), res);
    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({ error: 'invalid_args' });
  });

  it('maps handler_error -> 500', async () => {
    dispatch.mockResolvedValue({ ok: false, error: 'handler_error', message: 'db down' });
    const res = mockRes();
    await handler(mockReq({ toolName: 'record_checkin', args: { sleep: 4 } }), res);
    expect(res._status).toBe(500);
    expect(res._json).toMatchObject({ error: 'handler_error' });
  });

  it('defaults timezone to UTC when absent', async () => {
    dispatch.mockResolvedValue({ ok: true, result: {} });
    const res = mockRes();
    await handler(mockReq({ toolName: 'record_checkin', args: { mood: 3 } }), res);
    expect(dispatch).toHaveBeenCalledWith(
      'record_checkin',
      { mood: 3 },
      {
        anon_id: 'anon-A',
        timezone: 'UTC',
      },
    );
  });
});
