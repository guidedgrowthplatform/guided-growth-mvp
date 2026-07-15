/**
 * PUT /api/onboarding (root) — step save + JSONB data merge.
 *
 * Regression guard for the retracted "profile beat does not persist/advance"
 * report (gg-spec qa-live-onboarding-walk-2026-07-11.md, CORRECTION 2026-07-12).
 *
 * The live onboarding fires TWO PUTs for the profile beat:
 *   1. an up-front nickname-only persist at mount
 *      (src/onboarding-flow/FlowOnboarding.tsx:75 — saveStep(1, { nickname })),
 *   2. the real profile submit carrying age + gender
 *      (src/onboarding-flow/renderer/componentRegistry.tsx:623 — { age, gender }
 *       → useFlowOrchestrator.ts:631 saveStep(node.persist.step [== 1], cap.data)).
 *
 * The walker inspected the FIRST response (`current_step:1, data:{nickname}`)
 * and mistook it for the profile submit — concluding age/gender were "lost" and
 * the step was "stuck". These tests lock the actual contract of the route so
 * that misread can never masquerade as a real regression again, and so a future
 * refactor that genuinely drops age/gender or stops merging is caught:
 *
 *   - the route MERGES data (`data || $4::jsonb`), never replaces it, so the
 *     second PUT's age/gender land on top of the first PUT's nickname;
 *   - current_step advances via GREATEST (monotonic) — a step-1 write over an
 *     existing step-1 row keeping current_step at 1 is BY DESIGN, not a bug (the
 *     tap advance is a local machine transition, not a current_step climb).
 *
 * Auth + Supabase are mocked. We assert the SQL/params the handler issues and
 * that the DB row is returned verbatim, matching the sibling profile-patch test.
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

function putStep(body: Record<string, unknown>): VercelRequest {
  return {
    method: 'PUT',
    // No '...path' segment → route '' → the root step-save handler.
    query: {},
    body,
    headers: {},
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

describe('PUT /api/onboarding — profile step save merges age + gender (#243 guard)', () => {
  it('the real profile PUT persists age + gender ON TOP of the nickname row (200, not lost)', async () => {
    // Simulate the DB AFTER the merge: the up-front nickname persist already
    // created the row, so the returned row carries nickname + age + gender.
    pool.query.mockResolvedValue({
      rows: [
        {
          id: 'row-1',
          anon_id: 'anon-A',
          path: null,
          current_step: 1,
          status: 'in_progress',
          data: { nickname: 'Fable', age: 24, gender: 'Male' },
          brain_dump_raw: null,
          brain_dump_parsed: null,
          completed_at: null,
          updated_at: '2026-07-11T19:27:39.860Z',
          created_at: '2026-07-11T19:27:00.000Z',
        },
      ],
    });

    const res = mockRes();
    await handler(putStep({ step: 1, path: null, data: { age: 24, gender: 'Male' } }), res);

    // 200 (res.json, never a 400) and the row echoes back with age + gender present.
    expect(res._status).toBe(0);
    expect((res._body as { data: Record<string, unknown> }).data).toEqual({
      nickname: 'Fable',
      age: 24,
      gender: 'Male',
    });

    const [sql, params] = pool.query.mock.calls[0];
    // MERGE, not replace — this is why the second PUT does not clobber nickname
    // and the first PUT (nickname-only) does not hide age/gender.
    expect(sql).toMatch(/data = onboarding_states\.data \|\| \$4::jsonb/);
    // Monotonic advance — GREATEST guarantees a lower/equal step can never lower it.
    expect(sql).toMatch(/current_step = GREATEST\(onboarding_states\.current_step, \$2\)/);
    // Ownership: keyed on the caller's anon_id (RLS + anon_id preserved).
    expect(params[0]).toBe('anon-A');
    // Step value passed straight through as $2.
    expect(params[1]).toBe(1);
    // age + gender are serialized into the $4 jsonb payload that gets merged.
    expect(JSON.parse(params[3] as string)).toEqual({ age: 24, gender: 'Male' });
  });

  it('current_step staying at 1 for the profile beat is BY DESIGN (GREATEST, step 1 == step 1)', async () => {
    // Row already at step 1 (up-front nickname persist). The profile submit is
    // also step 1, so GREATEST(1, 1) = 1: no climb, and that is correct — the
    // tap advance is a client-side machine transition, not a step bump.
    pool.query.mockResolvedValue({
      rows: [
        {
          id: 'row-1',
          anon_id: 'anon-A',
          path: null,
          current_step: 1,
          status: 'in_progress',
          data: { nickname: 'Fable', age: 30, gender: 'Female' },
          updated_at: '2026-07-11T19:27:39.860Z',
        },
      ],
    });

    const res = mockRes();
    await handler(putStep({ step: 1, path: null, data: { age: 30, gender: 'Female' } }), res);

    expect((res._body as { current_step: number }).current_step).toBe(1);
    expect((res._body as { data: Record<string, unknown> }).data).toMatchObject({
      age: 30,
      gender: 'Female',
    });
  });

  it('rejects a PUT with no step (400) — the only real guard on this route', async () => {
    const res = mockRes();
    await handler(putStep({ path: null, data: { age: 24, gender: 'Male' } }), res);
    expect(res._status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
