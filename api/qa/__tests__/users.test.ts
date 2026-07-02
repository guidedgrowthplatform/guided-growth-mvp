/**
 * GET /api/qa/users must return the account list even when the onboarded
 * enrichment query fails (fresh DB without profiles, stale pool credential
 * after a password rotation). The badge is decoration, not a dependency.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../_lib/db.js', () => ({
  default: { query: vi.fn() },
}));
vi.mock('../../_lib/supabase-admin.js', () => ({
  supabaseAdmin: { auth: { admin: { listUsers: vi.fn() } } },
}));
vi.mock('../../_lib/auth.js', () => ({
  handlePreflight: vi.fn(() => false),
}));

const pool = (await import('../../_lib/db.js')).default as { query: ReturnType<typeof vi.fn> };
const { supabaseAdmin } = await import('../../_lib/supabase-admin.js');
const listUsers = supabaseAdmin.auth.admin.listUsers as ReturnType<typeof vi.fn>;
const handler = (await import('../users.js')).default;

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
  };
  return res as VercelResponse & { _status: number; _body: unknown };
}

const QA_PAGE = {
  data: {
    users: [
      { id: '11111111-1111-4111-8111-111111111111', email: 'qa-onboarding-fable@guidedgrowth.test' },
      { id: '22222222-2222-4222-8222-222222222222', email: 'qa-onboarding-yair@guidedgrowth.test' },
      { id: '33333333-3333-4333-8333-333333333333', email: 'real-user@example.com' },
    ],
  },
  error: null,
};

describe('GET /api/qa/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsers.mockResolvedValue(QA_PAGE);
  });

  it('returns the list with onboarded flags when the profiles query works', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: '22222222-2222-4222-8222-222222222222' }] });
    const res = mockRes();
    await handler({ method: 'GET' } as VercelRequest, res);
    expect(res._status).toBe(200);
    const body = res._body as { users: { email: string; onboarded?: boolean }[] };
    expect(body.users.map((u) => u.email)).toEqual([
      'qa-onboarding-fable@guidedgrowth.test',
      'qa-onboarding-yair@guidedgrowth.test',
    ]);
    expect(body.users.find((u) => u.email.includes('yair'))?.onboarded).toBe(true);
    expect(body.users.find((u) => u.email.includes('fable'))?.onboarded).toBe(false);
  });

  it('still returns the list (without badges) when the profiles query throws', async () => {
    pool.query.mockRejectedValue(new Error('password authentication failed'));
    const res = mockRes();
    await handler({ method: 'GET' } as VercelRequest, res);
    expect(res._status).toBe(200);
    const body = res._body as { users: { email: string; onboarded?: boolean }[] };
    expect(body.users).toHaveLength(2);
    expect(body.users.every((u) => u.onboarded === undefined)).toBe(true);
  });
});
