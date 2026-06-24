import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../db.js', () => ({ default: { query: (...a: unknown[]) => queryMock(...a) } }));
vi.mock('../auth.js', () => ({
  handlePreflight: vi.fn(() => false),
  requireUser: vi.fn(),
  setUserContext: vi.fn(),
}));

const handler = (await import('../../context/[...path].js')).default;

function mockRes() {
  const res: Partial<VercelResponse> & {
    _status: number;
    _body: unknown;
    _headers: Record<string, string>;
  } = {
    _status: 0,
    _body: undefined,
    _headers: {},
    status(code: number) {
      this._status = code;
      return this as VercelResponse;
    },
    json(body: unknown) {
      this._body = body;
      return this as VercelResponse;
    },
    setHeader(key: string, value: string) {
      this._headers![key] = value;
      return this as unknown as VercelResponse;
    },
  };
  return res as VercelResponse & {
    _status: number;
    _body: unknown;
    _headers: Record<string, string>;
  };
}

function routesReq(): VercelRequest {
  return {
    method: 'GET',
    query: { '...path': ['routes'] },
    headers: {},
  } as unknown as VercelRequest;
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('GET /api/context/routes', () => {
  it('returns 200 with the route map and a cacheable header', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ screen_id: 'HOME', route: '/home' }] });
    const res = mockRes();
    await handler(routesReq(), res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ routes: [{ screen_id: 'HOME', route: '/home' }] });
    expect(res._headers['Cache-Control']).toMatch(/max-age=300/);
  });

  it('returns 503 instead of crashing when the DB query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();

    // before the fix this rejected (FUNCTION_INVOCATION_FAILED); now it resolves to 503
    await handler(routesReq(), res);

    expect(res._status).toBe(503);
    expect(res._body).toEqual({ error: 'Route map temporarily unavailable' });
    errSpy.mockRestore();
  });
});
