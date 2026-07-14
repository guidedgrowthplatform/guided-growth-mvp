import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_lib/db.js', () => ({ default: { query: vi.fn() } }));
vi.mock('../_lib/auth.js', () => ({
  requireUser: vi.fn(async () => ({ anonId: 'anon-1' })),
  handlePreflight: vi.fn(() => false),
}));
// waitUntil normally needs a request context; pass the promise through in tests.
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => p }));

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

function disconnectReq() {
  return {
    method: 'POST',
    query: { '...path': 'disconnect' },
    headers: {},
  } as unknown as import('@vercel/node').VercelRequest;
}

// Route Google calls by URL: token refresh returns an access token; everything
// else (event deletes, calendar delete, revoke) returns 204.
function wireFetch() {
  global.fetch = vi.fn((url: unknown) => {
    if (typeof url === 'string' && url.endsWith('oauth2.googleapis.com/token')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'a', expires_in: 3600 }),
        text: async () => '',
      });
    }
    return Promise.resolve({ ok: true, status: 204, json: async () => ({}), text: async () => '' });
  }) as unknown as typeof fetch;
}

function wireQuery(opts: { connRow?: Record<string, unknown> | null; mapRows?: unknown[] }) {
  query.mockImplementation((sql: string) => {
    if (/SELECT refresh_token, gg_calendar_id/.test(sql)) {
      return Promise.resolve({ rows: opts.connRow ? [opts.connRow] : [] });
    }
    if (/SELECT calendar_id, google_event_id/.test(sql)) {
      return Promise.resolve({ rows: opts.mapRows ?? [] });
    }
    return Promise.resolve({ rows: [] }); // the two DELETEs
  });
}

// DELETE calls to a whole calendar (…/calendars/<id>) — NOT event deletes
// (…/calendars/<id>/events/<ev>).
function calendarShellDeletes() {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c) =>
      /\/calendar\/v3\/calendars\/[^/]+$/.test(c[0] as string) &&
      (c[1] as RequestInit | undefined)?.method === 'DELETE',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  wireFetch();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/calendar/disconnect', () => {
  it('deletes the Guided Growth calendar shell and drops the rows', async () => {
    wireQuery({
      connRow: { refresh_token: 'r', gg_calendar_id: 'gg-1' },
      mapRows: [{ calendar_id: 'gg-1', google_event_id: 'ev-1' }],
    });
    const res = mockRes();
    await handler(disconnectReq(), res);

    expect(res._body).toEqual({ ok: true });
    const del = calendarShellDeletes().find((c) => (c[0] as string).endsWith('/calendars/gg-1'));
    expect(del).toBeTruthy();
    expect(
      query.mock.calls.some((c) => /DELETE FROM calendar_connections/.test(c[0] as string)),
    ).toBe(true);
    expect(
      query.mock.calls.some((c) => /DELETE FROM calendar_event_map/.test(c[0] as string)),
    ).toBe(true);
  });

  it('no gg_calendar_id → no calendar-shell delete', async () => {
    wireQuery({ connRow: { refresh_token: 'r', gg_calendar_id: null }, mapRows: [] });
    const res = mockRes();
    await handler(disconnectReq(), res);
    expect(res._body).toEqual({ ok: true });
    expect(calendarShellDeletes().length).toBe(0);
  });

  it('not connected (no row) → ok, no Google calls', async () => {
    wireQuery({ connRow: null });
    const res = mockRes();
    await handler(disconnectReq(), res);
    expect(res._body).toEqual({ ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
