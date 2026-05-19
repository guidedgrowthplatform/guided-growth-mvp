import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  default: { query: vi.fn() },
}));
vi.mock('../supabase-admin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
  },
}));

const pool = (await import('../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { supabaseAdmin } = await import('../supabase-admin.js');
const supaGetUser = supabaseAdmin.auth.getUser as unknown as ReturnType<typeof vi.fn>;
const { readClaimsFromJwt, getUser, requireUser, requireAdmin } = await import('../auth.js');

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer tok' },
    ...overrides,
  } as unknown as VercelRequest;
}

function mockRes() {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this as unknown as VercelResponse;
    },
    json(body: unknown) {
      this._body = body;
      return this as unknown as VercelResponse;
    },
  };
  return res as typeof res & VercelResponse;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readClaimsFromJwt', () => {
  it('full claims → returns all fields', () => {
    const out = readClaimsFromJwt({
      anon_id: 'a-1',
      first_name: 'Yair',
      role: 'admin',
      status: 'disabled',
    });
    expect(out).toEqual({
      anonId: 'a-1',
      firstName: 'Yair',
      role: 'admin',
      status: 'disabled',
    });
  });

  it('anon_id present, first_name absent → firstName null', () => {
    const out = readClaimsFromJwt({ anon_id: 'a-1', role: 'user', status: 'active' });
    expect(out).toEqual({ anonId: 'a-1', firstName: null, role: 'user', status: 'active' });
  });

  it('anon_id absent → null', () => {
    expect(readClaimsFromJwt({ role: 'user', status: 'active' })).toBeNull();
  });

  it('unknown role → defaults to user', () => {
    const out = readClaimsFromJwt({ anon_id: 'a', role: 'superuser', status: 'active' });
    expect(out?.role).toBe('user');
  });

  it('unknown status → defaults to active', () => {
    const out = readClaimsFromJwt({ anon_id: 'a', role: 'user', status: 'banned' });
    expect(out?.status).toBe('active');
  });
});

describe('getUser', () => {
  it('JWT fast path → does not call pool.query', async () => {
    supaGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'u1@example.com',
          app_metadata: { anon_id: 'a1', first_name: 'A', role: 'user', status: 'active' },
        },
      },
      error: null,
    });

    const out = await getUser(mockReq());
    expect(out).toEqual({
      authUserId: 'u1',
      anonId: 'a1',
      firstName: 'A',
      email: 'u1@example.com',
      role: 'user',
      status: 'active',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('legacy token (no anon_id) → falls back to DB, info logs', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    supaGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u2',
          email: 'u2@example.com',
          app_metadata: { role: 'user', status: 'active' },
        },
      },
      error: null,
    });
    pool.query.mockResolvedValue({ rows: [{ anon_id: 'a2', first_name: 'B' }] });

    const out = await getUser(mockReq());
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(out?.anonId).toBe('a2');
    expect(out?.firstName).toBe('B');
    expect(info).toHaveBeenCalledWith(
      '[auth] legacy token, fell back to profiles SELECT',
      'u2',
    );
    info.mockRestore();
  });

  it('legacy token with missing profiles row → null and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    supaGetUser.mockResolvedValue({
      data: {
        user: { id: 'u3', email: 'u3@example.com', app_metadata: {} },
      },
      error: null,
    });
    pool.query.mockResolvedValue({ rows: [] });

    const out = await getUser(mockReq());
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[auth] profile row missing for authenticated user',
      'u3',
    );
    warn.mockRestore();
  });

  it('missing Authorization header → null, no DB or supabase calls', async () => {
    const out = await getUser(mockReq({ headers: {} }));
    expect(out).toBeNull();
    expect(supaGetUser).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('malformed Bearer (empty token) → supabase errors, returns null', async () => {
    supaGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad jwt' },
    });
    const out = await getUser(mockReq({ headers: { authorization: 'Bearer ' } }));
    expect(out).toBeNull();
  });

  it('supabaseAdmin.auth.getUser throws → null', async () => {
    supaGetUser.mockRejectedValue(new Error('boom'));
    const out = await getUser(mockReq());
    expect(out).toBeNull();
  });
});

describe('requireUser / requireAdmin', () => {
  function setUserMeta(meta: Record<string, unknown>, opts: { email?: string; id?: string } = {}) {
    supaGetUser.mockResolvedValue({
      data: {
        user: {
          id: opts.id ?? 'u1',
          email: opts.email ?? 'u1@example.com',
          app_metadata: meta,
        },
      },
      error: null,
    });
  }

  it('requireUser happy path → returns user', async () => {
    setUserMeta({ anon_id: 'a1', role: 'user', status: 'active' });
    const res = mockRes();
    const out = await requireUser(mockReq(), res);
    expect(out?.anonId).toBe('a1');
    expect(res._status).toBe(0);
  });

  it('requireUser no user → 401', async () => {
    supaGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'x' } });
    const res = mockRes();
    const out = await requireUser(mockReq(), res);
    expect(out).toBeNull();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Authentication required' });
  });

  it('requireUser disabled → 403 Account disabled', async () => {
    setUserMeta({ anon_id: 'a1', role: 'user', status: 'disabled' });
    const res = mockRes();
    const out = await requireUser(mockReq(), res);
    expect(out).toBeNull();
    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: 'Account disabled' });
  });

  it('requireAdmin non-admin → 403 Admin access required', async () => {
    setUserMeta({ anon_id: 'a1', role: 'user', status: 'active' });
    const res = mockRes();
    const out = await requireAdmin(mockReq(), res);
    expect(out).toBeNull();
    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: 'Admin access required' });
  });

  it('requireAdmin admin → returns user', async () => {
    setUserMeta({ anon_id: 'a1', role: 'admin', status: 'active' });
    const res = mockRes();
    const out = await requireAdmin(mockReq(), res);
    expect(out?.role).toBe('admin');
    expect(res._status).toBe(0);
  });
});
