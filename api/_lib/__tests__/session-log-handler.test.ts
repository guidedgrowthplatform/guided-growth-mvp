/**
 * Validates the input-validation surface of POST /api/session_log. Pure
 * request/response unit test — no DB. The actual insert is mocked.
 *
 * Covers P1-04 VERIFY-3 in spirit ("cross-user 403"): user_id is taken from
 * the validated bearer token, never from the body, so a forged user_id is
 * structurally impossible. We assert that the handler always uses req.user.id
 * when calling the pool.
 *
 * Live perf tests (VERIFY-1: 1000 inserts <2s, VERIFY-2: 50-row query <50ms)
 * live in a separate script that hits Supabase directly — they need real
 * latencies and a real connection, not a mock.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  default: { query: vi.fn() },
}));
vi.mock('../auth.js', () => ({
  requireUser: vi.fn(),
  setUserContext: vi.fn(),
  handlePreflight: vi.fn(() => false),
}));

const pool = (await import('../db.js')).default as { query: ReturnType<typeof vi.fn> };
const auth = await import('../auth.js');
const handler = (await import('../../session_log/[...path].js')).default;

function mockRes() {
  const res: Partial<VercelResponse> & { _status: number; _body: unknown } = {
    _status: 0,
    _body: undefined,
    status(code: number) {
      this._status = code;
      return this as VercelResponse;
    },
    json(body: unknown) {
      this._body = body;
      return this as VercelResponse;
    },
    setHeader: vi.fn(),
  };
  return res as VercelResponse & { _status: number; _body: unknown };
}

function mockReq(overrides: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'POST',
    query: { '...path': '__index' },
    body: {},
    headers: {},
    ...overrides,
  } as unknown as VercelRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'user-A',
    email: 'a@example.com',
    role: 'user',
    status: 'active',
  });
  pool.query.mockResolvedValue({
    rows: [{ id: '123', timestamp: new Date('2026-05-11T12:00:00Z') }],
  });
});

describe('POST /api/session_log', () => {
  it('writes user.id from the bearer token, never from the body', async () => {
    const req = mockReq({
      body: {
        session_id: 's1',
        event_type: 'navigate',
        // Attempt to forge a different user_id — handler must ignore it.
        user_id: 'user-B',
      },
    });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe('user-A'); // server-side user id, not 'user-B'
  });

  it('returns 400 when session_id missing', async () => {
    const req = mockReq({ body: { event_type: 'navigate' } });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 400 when event_type is not in the whitelist', async () => {
    const req = mockReq({
      body: { session_id: 's1', event_type: 'auth_started' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect((res._body as { error: string }).error).toBe('invalid event_type');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 400 when payload is not an object', async () => {
    const req = mockReq({
      body: { session_id: 's1', event_type: 'navigate', payload: 'not-an-object' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 400 when payload is an array', async () => {
    const req = mockReq({
      body: { session_id: 's1', event_type: 'navigate', payload: [1, 2, 3] },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 401 when no user (pre-auth)', async () => {
    (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'Authentication required' });
        return null;
      },
    );
    const req = mockReq({
      body: { session_id: 's1', event_type: 'navigate' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 405 on non-POST methods', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 201 with {id, timestamp} on success', async () => {
    const req = mockReq({
      body: { session_id: 's1', event_type: 'habit_added' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(201);
    expect(res._body).toMatchObject({ id: '123' });
  });

  it('persists screen_id and payload when provided', async () => {
    const req = mockReq({
      body: {
        session_id: 's1',
        event_type: 'habit_added',
        screen_id: 'HABIT-CREATE-FORK',
        payload: { habit_id: 'h-1', name: 'water' },
      },
    });
    const res = mockRes();
    await handler(req, res);
    const [, params] = pool.query.mock.calls[0];
    // [user_id, session_id, event_type, screen_id, payload]
    expect(params[3]).toBe('HABIT-CREATE-FORK');
    expect(params[4]).toEqual({ habit_id: 'h-1', name: 'water' });
  });
});
