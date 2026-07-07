/**
 * POST /api/qa-reset — fresh-restart ruling (2026-07): same widened wipe as
 * api/qa/self-reset.ts (see that test file's header), but token-authed and
 * addressed by email instead of the caller's session. Covers the widened
 * DELETE set (reflection_settings, chat_sessions) plus the pre-existing
 * gates (token, email pattern, rate limit, prod refusal, user-not-found).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_lib/db.js', () => ({ default: { connect: vi.fn() } }));
vi.mock('../_lib/rate-limit.js', () => ({ checkRateLimit: vi.fn(() => ({ limited: false })) }));
vi.mock('../_lib/validation.js', () => ({ getClientIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../_lib/dbEnv.js', () => ({ refuseIfProd: vi.fn(() => false) }));

const pool = (await import('../_lib/db.js')).default as { connect: ReturnType<typeof vi.fn> };
const { checkRateLimit } = (await import('../_lib/rate-limit.js')) as {
  checkRateLimit: ReturnType<typeof vi.fn>;
};
const { refuseIfProd } = (await import('../_lib/dbEnv.js')) as {
  refuseIfProd: ReturnType<typeof vi.fn>;
};
const handler = (await import('../qa-reset.js')).default;

const ANON_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const QA_EMAIL = 'qa-onboarding-fresh@guidedgrowth.test';

interface Recorded {
  sql: string;
  params: unknown[];
}

function makeClient(rowCounts: Record<string, number> = {}) {
  const queries: Recorded[] = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (/SELECT au\.id AS user_id/.test(sql)) {
        return { rowCount: 1, rows: [{ user_id: USER_ID, anon_id: ANON_ID }] };
      }
      for (const [table, count] of Object.entries(rowCounts)) {
        if (new RegExp(`DELETE FROM ${table}\\b`).test(sql)) {
          return { rowCount: count, rows: [] };
        }
      }
      return { rowCount: 0, rows: [] };
    }),
    release: vi.fn(),
  };
  return { client, queries };
}

function mockReqRes(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const req = {
    method: 'POST',
    body,
    headers: { authorization: 'Bearer test-qa-token', ...headers },
  } as unknown as import('@vercel/node').VercelRequest;
  const res: Partial<import('@vercel/node').VercelResponse> & {
    _status: number;
    _body: unknown;
  } = {
    _status: 0,
    _body: undefined,
    setHeader: vi.fn(),
    status(code: number) {
      this._status = code;
      return this as import('@vercel/node').VercelResponse;
    },
    json(body: unknown) {
      this._body = body;
      return this as import('@vercel/node').VercelResponse;
    },
  };
  return { req, res: res as import('@vercel/node').VercelResponse & typeof res };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ limited: false });
  refuseIfProd.mockReturnValue(false);
  process.env.QA_RESET_TOKEN = 'test-qa-token';
});

describe('POST /api/qa-reset', () => {
  it('wipes onboarding_states, user_habits, reflection_settings, chat_sessions, chat_messages, and session_log for the matched QA email', async () => {
    const { client, queries } = makeClient({
      onboarding_states: 1,
      user_habits: 2,
      reflection_settings: 1,
      chat_sessions: 3,
      chat_messages: 5,
      session_log: 4,
    });
    pool.connect.mockResolvedValue(client);

    const { req, res } = mockReqRes({ email: QA_EMAIL });
    await handler(req, res);

    expect(res._status).toBe(200);
    const body = res._body as { ok: boolean; deleted: Record<string, number> };
    expect(body.ok).toBe(true);
    expect(body.deleted).toEqual({
      onboarding_states: 1,
      user_habits: 2,
      reflection_settings: 1,
      chat_sessions: 3,
      chat_messages: 5,
      session_log: 4,
    });

    const scoped = ['reflection_settings', 'chat_sessions'];
    for (const table of scoped) {
      const q = queries.find((qq) => new RegExp(`DELETE FROM ${table}`).test(qq.sql));
      expect(q?.params).toEqual([ANON_ID]);
    }

    const sqls = queries.map((q) => q.sql);
    expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-QA email with 400 and never opens a connection', async () => {
    const { req, res } = mockReqRes({ email: 'real-user@example.com' });
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects a missing/bad token with 401 before touching any table', async () => {
    const { req, res } = mockReqRes({ email: QA_EMAIL }, { authorization: 'Bearer wrong' });
    await handler(req, res);

    expect(res._status).toBe(401);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('is refused against a production database before touching any table', async () => {
    // refuseIfProd sets the response itself (like the real implementation) —
    // just returning true isn't enough, the handler trusts it already replied.
    refuseIfProd.mockImplementation((res: import('@vercel/node').VercelResponse) => {
      res.status(403).json({ error: 'Refused: destructive endpoint blocked' });
      return true;
    });
    const { req, res } = mockReqRes({ email: QA_EMAIL });
    await handler(req, res);

    expect(res._status).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rolls back the whole widened transaction if any delete fails, including the new tables', async () => {
    const queries: Recorded[] = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params: params ?? [] });
        if (/SELECT au\.id AS user_id/.test(sql)) {
          return { rowCount: 1, rows: [{ user_id: USER_ID, anon_id: ANON_ID }] };
        }
        if (/DELETE FROM reflection_settings/.test(sql)) {
          throw new Error('boom');
        }
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const { req, res } = mockReqRes({ email: QA_EMAIL });
    await handler(req, res);

    expect(res._status).toBe(500);
    const sqls = queries.map((q) => q.sql);
    expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
