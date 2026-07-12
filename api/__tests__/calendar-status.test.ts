import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_lib/db.js', () => ({ default: { query: vi.fn() } }));
vi.mock('../_lib/auth.js', () => ({
  requireUser: vi.fn(async () => ({ anonId: 'anon-1' })),
  handlePreflight: vi.fn(() => false),
}));

const pool = (await import('../_lib/db.js')).default as unknown as {
  query: ReturnType<typeof vi.fn>;
};
const handler = (await import('../calendar/[...path].js')).default;

const query = pool.query;

function mockRes() {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    setHeader: vi.fn(),
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res as typeof res & import('@vercel/node').VercelResponse;
}

function statusReq() {
  return {
    method: 'GET',
    query: { '...path': 'status' },
    headers: {},
  } as unknown as import('@vercel/node').VercelRequest;
}

// query router: distinguish the handler's own SELECT from getValidAccessToken's.
function wire(opts: {
  statusRow?: Record<string, unknown> | null;
  tokenRow?: Record<string, unknown> | null;
}) {
  query.mockImplementation((sql: string) => {
    if (/SELECT target, enabled/.test(sql)) {
      return Promise.resolve({ rows: opts.statusRow ? [opts.statusRow] : [] });
    }
    if (/access_token, refresh_token/.test(sql)) {
      return Promise.resolve({ rows: opts.tokenRow ? [opts.tokenRow] : [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const past = () => new Date(Date.now() - 3_600_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/calendar/status', () => {
  it('no row → disconnected', async () => {
    wire({ statusRow: null });
    const res = mockRes();
    await handler(statusReq(), res);
    expect(res._body).toEqual({
      connected: false,
      target: 'gg',
      enabled: false,
      needsReauth: false,
    });
  });

  it('paused (enabled=false) → connected, no token probe', async () => {
    wire({ statusRow: { target: 'own', enabled: false } });
    const res = mockRes();
    await handler(statusReq(), res);
    expect(res._body).toEqual({
      connected: true,
      target: 'own',
      enabled: false,
      needsReauth: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
    // Only the status SELECT ran — never the token SELECT.
    expect(query.mock.calls.every((c) => !/access_token, refresh_token/.test(c[0] as string))).toBe(
      true,
    );
  });

  it('healthy (cached valid token) → needsReauth false, no Google call', async () => {
    wire({
      statusRow: { target: 'gg', enabled: true },
      tokenRow: {
        access_token: 'x',
        refresh_token: 'r',
        token_expires_at: future(),
        enabled: true,
      },
    });
    const res = mockRes();
    await handler(statusReq(), res);
    expect(res._body).toEqual({ connected: true, target: 'gg', enabled: true, needsReauth: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('invalid_grant on refresh → needsReauth true, still connected', async () => {
    wire({
      statusRow: { target: 'gg', enabled: true },
      tokenRow: { access_token: null, refresh_token: 'r', token_expires_at: past(), enabled: true },
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
      text: async () => JSON.stringify({ error: 'invalid_grant' }),
    });
    const res = mockRes();
    await handler(statusReq(), res);
    expect(res._body).toEqual({ connected: true, target: 'gg', enabled: true, needsReauth: true });
  });

  it('Google 5xx on refresh → no false alarm', async () => {
    wire({
      statusRow: { target: 'gg', enabled: true },
      tokenRow: { access_token: null, refresh_token: 'r', token_expires_at: past(), enabled: true },
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => 'unavailable',
    });
    const res = mockRes();
    await handler(statusReq(), res);
    expect(res._body).toEqual({ connected: true, target: 'gg', enabled: true, needsReauth: false });
  });

  it('row vanished between select and probe → disconnected', async () => {
    wire({ statusRow: { target: 'gg', enabled: true }, tokenRow: null });
    const res = mockRes();
    await handler(statusReq(), res);
    expect(res._body).toEqual({
      connected: false,
      target: 'gg',
      enabled: false,
      needsReauth: false,
    });
  });
});
