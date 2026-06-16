/**
 * POST /api/chat/session — resolve-or-mint. Pure request/response unit test;
 * the DB is mocked. Asserts server owns the session id (resume recent / mint
 * fresh / skip stale) and binds it to the bearer-token anon_id.
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
const handler = (await import('../../chat/[...path].js')).default;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    query: { '...path': 'session' },
    body: { screen_id: 'ONBOARD-01' },
    headers: {},
    ...overrides,
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

describe('POST /api/chat/session', () => {
  it('resumes the most recent session within the window', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ chat_session_id: 'sess-recent' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'm1', turn_index: 0, role: 'user', content: 'hi', tool_calls: null }],
      });

    const res = mockRes();
    await handler(mockReq({}), res);

    expect(res._status).toBe(200);
    expect((res._body as { chat_session_id: string }).chat_session_id).toBe('sess-recent');
    expect((res._body as { messages: unknown[] }).messages).toHaveLength(1);
    // recency lookup is scoped to the token anon_id
    expect(pool.query.mock.calls[0][1][0]).toBe('anon-A');
  });

  it('mints a fresh UUID when no recent session exists', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // recency lookup
      .mockResolvedValueOnce({
        rows: [{ chat_session_id: '550e8400-e29b-41d4-a716-446655440000' }],
      }); // cold-mint upsert

    const res = mockRes();
    await handler(mockReq({}), res);

    expect(res._status).toBe(200);
    const body = res._body as { chat_session_id: string; messages: unknown[] };
    expect(body.chat_session_id).toMatch(UUID_RE);
    expect(body.messages).toEqual([]);
    // recency lookup + idempotent upsert; no history load
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns the anchored id when a concurrent cold open already minted one', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // no recent messages
      .mockResolvedValueOnce({ rows: [{ chat_session_id: 'sess-anchored' }] }); // upsert reused existing

    const res = mockRes();
    await handler(mockReq({}), res);

    const body = res._body as { chat_session_id: string; messages: unknown[] };
    expect(body.chat_session_id).toBe('sess-anchored');
    expect(body.messages).toEqual([]);
  });

  it('mints fresh when the only session is stale (outside the window)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ chat_session_id: '550e8400-e29b-41d4-a716-446655440000' }],
    });

    const res = mockRes();
    await handler(mockReq({}), res);

    const body = res._body as { chat_session_id: string };
    expect(body.chat_session_id).toMatch(UUID_RE);
  });

  it('returns 400 when screen_id is missing', async () => {
    const res = mockRes();
    await handler(mockReq({ body: {} }), res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth.requireUser as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: VercelRequest, res: VercelResponse) => {
        res.status(401).json({ error: 'Authentication required' });
        return null;
      },
    );
    const res = mockRes();
    await handler(mockReq({}), res);
    expect(res._status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 405 on non-POST', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(res._status).toBe(405);
  });
});

function decodeCursor(raw: string): { ts: string; id: string } {
  return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
}

function encodeCursor(c: { ts: string; id: string }): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function linearReq(query: Record<string, string>): VercelRequest {
  return {
    method: 'GET',
    query: { '...path': 'linear', ...query },
    headers: {},
  } as unknown as VercelRequest;
}

describe('GET /api/chat/linear', () => {
  const TS = '2026-06-17T10:00:00.000Z';
  const OLDEST_ID = '550e8400-e29b-41d4-a716-446655440099';

  it('returns chronological page with next_cursor + has_more when more exist', async () => {
    // 3 rows newest→oldest for limit=2 (limit+1 fetched).
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'm3',
          turn_index: 2,
          role: 'user',
          content: 'newest',
          tool_calls: null,
          created_at: '2026-06-17T12:00:00.000Z',
        },
        {
          id: 'm2',
          turn_index: 1,
          role: 'user',
          content: 'mid',
          tool_calls: null,
          created_at: '2026-06-17T11:00:00.000Z',
        },
        {
          id: OLDEST_ID,
          turn_index: 0,
          role: 'user',
          content: 'oldest',
          tool_calls: null,
          created_at: TS,
        },
      ],
    });

    const res = mockRes();
    await handler(linearReq({ limit: '2' }), res);

    expect(res._status).toBe(200);
    const body = res._body as {
      messages: Array<{ content: string }>;
      next_cursor: string;
      has_more: boolean;
    };
    expect(body.has_more).toBe(true);
    // page dropped extra row, reversed to oldest→newest
    expect(body.messages.map((m) => m.content)).toEqual(['mid', 'newest']);
    // cursor points at the oldest returned row (m2)
    expect(decodeCursor(body.next_cursor)).toEqual({ ts: '2026-06-17T11:00:00.000Z', id: 'm2' });
    expect(pool.query.mock.calls[0][1]).toEqual(['anon-A', 3]); // limit+1, no cursor
  });

  it('uses keyset predicate when before cursor supplied; null cursor at end', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'm0',
          turn_index: 0,
          role: 'user',
          content: 'first',
          tool_calls: null,
          created_at: TS,
        },
      ],
    });

    const res = mockRes();
    await handler(linearReq({ limit: '2', before: encodeCursor({ ts: TS, id: OLDEST_ID }) }), res);

    expect(res._status).toBe(200);
    const body = res._body as {
      messages: unknown[];
      next_cursor: string | null;
      has_more: boolean;
    };
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeNull();
    // keyset params: anon, cursor ts, cursor id, limit+1
    expect(pool.query.mock.calls[0][1]).toEqual(['anon-A', TS, OLDEST_ID, 3]);
  });

  it('returns 400 on an unparseable before cursor', async () => {
    const res = mockRes();
    await handler(linearReq({ before: '!!!not-base64-json!!!' }), res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 405 on non-GET', async () => {
    const res = mockRes();
    await handler({ ...linearReq({}), method: 'POST' } as VercelRequest, res);
    expect(res._status).toBe(405);
  });
});
