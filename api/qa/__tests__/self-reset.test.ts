/**
 * POST /api/qa/self-reset — fresh-restart ruling (2026-07): a QA reset must
 * wipe habits AND every onboarding-derived table, not just onboarding_states.
 * Covers the widened DELETE set (reflection_settings, chat_sessions, on top of
 * the pre-existing onboarding_states/user_habits/chat_messages/session_log)
 * plus the pre-existing security gates (QA email pattern, prod refusal).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../_lib/db.js', () => ({ default: { connect: vi.fn() } }));
vi.mock('../../_lib/auth.js', () => ({
  requireUser: vi.fn(),
  handlePreflight: vi.fn(() => false),
}));
vi.mock('../../_lib/dbEnv.js', () => ({ refuseIfProd: vi.fn(() => false) }));

const pool = (await import('../../_lib/db.js')).default as { connect: ReturnType<typeof vi.fn> };
const { requireUser } = (await import('../../_lib/auth.js')) as {
  requireUser: ReturnType<typeof vi.fn>;
};
const { refuseIfProd } = (await import('../../_lib/dbEnv.js')) as {
  refuseIfProd: ReturnType<typeof vi.fn>;
};
const handler = (await import('../self-reset.js')).default;

const ANON_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
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

function mockReqRes(method = 'POST') {
  const req = { method, headers: {} } as unknown as import('@vercel/node').VercelRequest;
  const res: Partial<import('@vercel/node').VercelResponse> & {
    _status: number;
    _body: unknown;
  } = {
    _status: 0,
    _body: undefined,
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
  refuseIfProd.mockReturnValue(false);
});

describe('POST /api/qa/self-reset', () => {
  it('wipes onboarding_states, user_habits, reflection_settings, chat_sessions, chat_messages, and session_log for the authed QA account', async () => {
    requireUser.mockResolvedValue({
      authUserId: AUTH_USER_ID,
      anonId: ANON_ID,
      email: QA_EMAIL,
    });
    const { client, queries } = makeClient({
      onboarding_states: 1,
      user_habits: 2,
      reflection_settings: 1,
      chat_sessions: 3,
      chat_messages: 5,
      session_log: 4,
    });
    pool.connect.mockResolvedValue(client);

    const { req, res } = mockReqRes();
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

    const sqls = queries.map((q) => q.sql);
    expect(sqls.some((s) => /DELETE FROM onboarding_states WHERE anon_id/.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM user_habits WHERE anon_id/.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM reflection_settings WHERE anon_id/.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM chat_sessions WHERE anon_id/.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM chat_messages WHERE anon_id/.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM session_log WHERE anon_id/.test(s))).toBe(true);
    expect(sqls.some((s) => /UPDATE profiles/.test(s))).toBe(true);

    // Every new delete is scoped to this account's anon_id, same as the
    // pre-existing deletes — no widening of the blast radius.
    const scoped = ['reflection_settings', 'chat_sessions'];
    for (const table of scoped) {
      const q = queries.find((qq) => new RegExp(`DELETE FROM ${table}`).test(qq.sql));
      expect(q?.params).toEqual([ANON_ID]);
    }

    expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-QA email with 403 and never opens a transaction', async () => {
    requireUser.mockResolvedValue({
      authUserId: AUTH_USER_ID,
      anonId: ANON_ID,
      email: 'real-user@example.com',
    });

    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res._status).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('is refused against a production database before touching any table', async () => {
    // refuseIfProd sets the response itself (like the real implementation) —
    // just returning true isn't enough, the handler trusts it already replied.
    refuseIfProd.mockImplementation((res: import('@vercel/node').VercelResponse) => {
      res.status(403).json({ error: 'Refused: destructive endpoint blocked' });
      return true;
    });
    requireUser.mockResolvedValue({
      authUserId: AUTH_USER_ID,
      anonId: ANON_ID,
      email: QA_EMAIL,
    });

    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res._status).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rolls back the whole widened transaction if any delete fails, including the new tables', async () => {
    requireUser.mockResolvedValue({
      authUserId: AUTH_USER_ID,
      anonId: ANON_ID,
      email: QA_EMAIL,
    });
    const queries: Recorded[] = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params: params ?? [] });
        if (/DELETE FROM chat_sessions/.test(sql)) {
          throw new Error('boom');
        }
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    const sqls = queries.map((q) => q.sql);
    expect(sqls.some((s) => /ROLLBACK/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
