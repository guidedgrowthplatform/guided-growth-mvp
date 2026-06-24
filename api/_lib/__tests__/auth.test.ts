import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const queryMock = vi.fn();

vi.mock('../supabase-admin.js', () => ({
  supabaseAdmin: { auth: { getUser: (...args: unknown[]) => getUserMock(...args) } },
}));
vi.mock('../db.js', () => ({
  default: { query: (...args: unknown[]) => queryMock(...args) },
}));

const { requireUser } = await import('../auth.js');

// base64url JWT with given exp (seconds); signature unused (only payload decoded)
function makeToken(exp: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp })}.sig`;
}

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600;
const PAST_EXP = Math.floor(Date.now() / 1000) - 3600;

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function mockReq(headers: Record<string, string> = {}): VercelRequest {
  return { headers } as unknown as VercelRequest;
}

function authedReq(exp: number): VercelRequest {
  return mockReq({ authorization: `Bearer ${makeToken(exp)}` });
}

class AuthApiError extends Error {
  status = 401;
  constructor() {
    super('invalid claim');
    this.name = 'AuthApiError';
  }
}

class AuthRetryableFetchError extends Error {
  status = 0;
  constructor() {
    super('network');
    this.name = 'AuthRetryableFetchError';
  }
}

beforeEach(() => {
  getUserMock.mockReset();
  queryMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('requireUser auth classification', () => {
  it('missing Authorization header -> 401 no_token', async () => {
    const res = mockRes();
    const out = await requireUser(mockReq(), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'no_token' }));
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('expired JWT (exp in past, getUser rejects) -> 401 token_expired', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new AuthApiError() });

    const res = mockRes();
    const out = await requireUser(authedReq(PAST_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'token_expired' }));
  });

  it('malformed/invalid token (AuthApiError, exp in future) -> 401 invalid_token', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new AuthApiError() });

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_token' }));
  });

  it('AuthRetryableFetchError -> 503 auth_unavailable', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError(),
    });

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth_unavailable' }));
  });

  it('getUser throws (network) -> 503 auth_unavailable', async () => {
    getUserMock.mockRejectedValue(new Error('socket hang up'));

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth_unavailable' }));
  });

  it('error with no http status -> 503 auth_unavailable', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: 'WeirdError', message: 'no status' },
    });

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth_unavailable' }));
  });

  it('profiles query throws (DB blip) -> 503 auth_unavailable (no logout)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.co', app_metadata: { status: 'active' } } },
      error: null,
    });
    queryMock.mockRejectedValue(new Error('connection terminated'));

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth_unavailable' }));
  });

  it('missing profile row -> 401 invalid_token', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.co', app_metadata: { status: 'active' } } },
      error: null,
    });
    queryMock.mockResolvedValue({ rows: [] });

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_token' }));
  });

  it('disabled status -> 403', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@b.co', app_metadata: { status: 'disabled' } },
      },
      error: null,
    });
    queryMock.mockResolvedValue({ rows: [{ anon_id: 'anon-1', first_name: 'Ada' }] });

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(out).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account disabled' });
  });

  it('happy path -> returns user, no error response', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@b.co', app_metadata: { role: 'user', status: 'active' } },
      },
      error: null,
    });
    queryMock.mockResolvedValue({ rows: [{ anon_id: 'anon-1', first_name: 'Ada' }] });

    const res = mockRes();
    const out = await requireUser(authedReq(FUTURE_EXP), res);

    expect(res.status).not.toHaveBeenCalled();
    expect(out).toEqual(
      expect.objectContaining({
        authUserId: 'u1',
        anonId: 'anon-1',
        firstName: 'Ada',
        email: 'a@b.co',
        role: 'user',
        status: 'active',
      }),
    );
  });
});
