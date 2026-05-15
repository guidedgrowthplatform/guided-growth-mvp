/**
 * PATCH /api/onboarding/profile — extension for P1-07 update_profile tool.
 *
 * The endpoint already supported name + nickname. P1-07 widens the surface
 * to the three typed profile columns (age_group, gender, referral_source)
 * that the LLM may legitimately set during a Vapi onboarding call.
 *
 * Auth + Supabase metadata sync are mocked. We assert the SQL the handler
 * issues, not the live DB behavior.
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
vi.mock('../supabase.js', () => ({
  supabaseAdmin: {
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({}) } },
    storage: { from: vi.fn() },
  },
}));

const pool = (await import('../db.js')).default as {
  query: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};
const auth = await import('../auth.js');
const handler = (await import('../../onboarding/[...path].js')).default;

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

function patchProfile(body: Record<string, unknown>): VercelRequest {
  return {
    method: 'PATCH',
    query: { '...path': 'profile' },
    body,
    headers: {},
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
  pool.query.mockResolvedValue({ rowCount: 1, rows: [] });
});

describe('PATCH /api/onboarding/profile — typed fields (P1-07)', () => {
  it('accepts age_group within length cap', async () => {
    const res = mockRes();
    await handler(patchProfile({ age_group: '25-34' }), res);
    expect(res._status).toBe(0); // default — handler returned 200 via res.json
    expect(res._body).toEqual({ ok: true });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE profiles SET .*age_group = \$/);
    expect(params).toEqual(['user-A', '25-34']);
  });

  it('accepts gender within length cap', async () => {
    const res = mockRes();
    await handler(patchProfile({ gender: 'non-binary' }), res);
    expect(res._body).toEqual({ ok: true });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/gender = \$/);
    expect(params).toEqual(['user-A', 'non-binary']);
  });

  it('accepts referral_source within length cap', async () => {
    const res = mockRes();
    await handler(patchProfile({ referral_source: 'friend' }), res);
    expect(res._body).toEqual({ ok: true });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/referral_source = \$/);
    expect(params).toEqual(['user-A', 'friend']);
  });

  it('rejects age_group above 50 chars', async () => {
    const res = mockRes();
    await handler(patchProfile({ age_group: 'a'.repeat(51) }), res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects gender of wrong type', async () => {
    const res = mockRes();
    await handler(patchProfile({ gender: 123 }), res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects referral_source above 50 chars', async () => {
    const res = mockRes();
    await handler(patchProfile({ referral_source: 'a'.repeat(51) }), res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('combines old + new fields in one UPDATE', async () => {
    const res = mockRes();
    await handler(patchProfile({ nickname: 'yair', age_group: '25-34' }), res);
    expect(res._body).toEqual({ ok: true });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/nickname = \$/);
    expect(sql).toMatch(/age_group = \$/);
    expect(params).toEqual(['user-A', 'yair', '25-34']);
  });
});
