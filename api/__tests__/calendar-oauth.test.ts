import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_SCOPES } from '@gg/shared/constants';

vi.mock('../_lib/db.js', () => ({ default: { query: vi.fn() } }));
vi.mock('../_lib/auth.js', () => ({
  requireUser: vi.fn(async () => ({ anonId: 'anon-1' })),
  handlePreflight: vi.fn(() => false),
}));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

const pool = (await import('../_lib/db.js')).default as unknown as {
  query: ReturnType<typeof vi.fn>;
};
const { requireUser } = await import('../_lib/auth.js');
const startHandler = (await import('../calendar/oauth-start.js')).default;
const callbackHandler = (await import('../calendar/oauth-callback.js')).default;
const query = pool.query;

function mockRes() {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    _location: undefined as string | undefined,
    setHeader(key: string, value: string) {
      if (key === 'Location') this._location = value;
      return this;
    },
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    end() {
      return this;
    },
  };
  return res as typeof res & import('@vercel/node').VercelResponse;
}

function startReq(body: Record<string, unknown>, method = 'POST') {
  return { method, headers: {}, body } as unknown as import('@vercel/node').VercelRequest;
}

function callbackReq(params: Record<string, string>, method = 'GET') {
  return { method, headers: {}, query: params } as unknown as import('@vercel/node').VercelRequest;
}

// Route callback DB calls by SQL: nonce consume, existing-token select, upsert.
function wireCallback(opts: { nonceRow?: Record<string, unknown> | null; existingToken?: string }) {
  query.mockImplementation((sql: string) => {
    if (/DELETE FROM calendar_oauth_state/.test(sql)) {
      return Promise.resolve({ rows: opts.nonceRow ? [opts.nonceRow] : [] });
    }
    if (/SELECT refresh_token FROM calendar_connections/.test(sql)) {
      return Promise.resolve({
        rows: opts.existingToken ? [{ refresh_token: opts.existingToken }] : [],
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

function fetchTokens(json: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => json,
    text: async () => JSON.stringify(json),
  });
}

const upsertRan = () =>
  query.mock.calls.some((c) => /INSERT INTO calendar_connections/.test(c[0] as string));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
  vi.stubEnv('CALENDAR_OAUTH_REDIRECT_ORIGIN', 'https://app.test');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/calendar/oauth-start', () => {
  it('web → 200 with a consent url carrying the nonce state', async () => {
    query.mockResolvedValue({ rows: [] });
    const res = mockRes();
    await startHandler(startReq({ platform: 'web' }), res);
    expect(res._status).toBe(200);
    const url = (res._body as { url: string }).url;
    expect(url).toContain('accounts.google.com');
    expect(url).toMatch(/state=[a-f0-9]{64}/);
    expect(url).toContain(encodeURIComponent('https://app.test/api/calendar/oauth-callback'));
  });

  it('native with a valid scheme → 200', async () => {
    query.mockResolvedValue({ rows: [] });
    const res = mockRes();
    await startHandler(startReq({ platform: 'native', scheme: 'guidedgrowthqa' }), res);
    expect(res._status).toBe(200);
  });

  it('rejects a non-POST method → 405', async () => {
    const res = mockRes();
    await startHandler(startReq({ platform: 'web' }, 'GET'), res);
    expect(res._status).toBe(405);
  });

  it('rejects an invalid platform → 400', async () => {
    const res = mockRes();
    await startHandler(startReq({ platform: 'desktop' }), res);
    expect(res._status).toBe(400);
  });

  it('rejects native with a bogus scheme → 400', async () => {
    const res = mockRes();
    await startHandler(startReq({ platform: 'native', scheme: 'guidedgrowth.evil' }), res);
    expect(res._status).toBe(400);
  });
});

describe('GET /api/calendar/oauth-callback', () => {
  it('is public (never calls requireUser) and rejects non-GET with 405', async () => {
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'n', code: 'c' }, 'POST'), res);
    expect(res._status).toBe(405);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('happy web → 302 to /settings?calendar=connected and upserts the token', async () => {
    wireCallback({ nonceRow: { anon_id: 'anon-1', platform: 'web', scheme: null } });
    fetchTokens({
      access_token: 'at',
      expires_in: 3600,
      refresh_token: 'refresh-token-xyz',
      scope: CALENDAR_SCOPES,
    });
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'n', code: 'c' }), res);
    expect(res._status).toBe(302);
    expect(res._location).toBe('https://app.test/settings?calendar=connected');
    expect(upsertRan()).toBe(true);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('happy native → 302 to the deep link under the auth host', async () => {
    wireCallback({ nonceRow: { anon_id: 'anon-1', platform: 'native', scheme: 'guidedgrowth' } });
    fetchTokens({
      access_token: 'at',
      expires_in: 3600,
      refresh_token: 'refresh-token-xyz',
      scope: CALENDAR_SCOPES,
    });
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'n', code: 'c' }), res);
    expect(res._location).toBe('guidedgrowth://auth/calendar-connected?calendar=connected');
  });

  it('missing / expired / used nonce → error redirect, no upsert', async () => {
    wireCallback({ nonceRow: null });
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'gone', code: 'c' }), res);
    expect(res._location).toBe('https://app.test/settings?calendar=error');
    expect(upsertRan()).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('Google access_denied → error redirect, no exchange', async () => {
    wireCallback({ nonceRow: { anon_id: 'anon-1', platform: 'web', scheme: null } });
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'n', error: 'access_denied' }), res);
    expect(res._location).toBe('https://app.test/settings?calendar=error');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(upsertRan()).toBe(false);
  });

  it('exchange returns no refresh_token → error, no upsert', async () => {
    wireCallback({ nonceRow: { anon_id: 'anon-1', platform: 'web', scheme: null } });
    fetchTokens({ access_token: 'at', expires_in: 3600, scope: CALENDAR_SCOPES });
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'n', code: 'c' }), res);
    expect(res._location).toBe('https://app.test/settings?calendar=error');
    expect(upsertRan()).toBe(false);
  });

  it('partial scope grant → error, no upsert', async () => {
    wireCallback({ nonceRow: { anon_id: 'anon-1', platform: 'web', scheme: null } });
    fetchTokens({
      access_token: 'at',
      expires_in: 3600,
      refresh_token: 'refresh-token-xyz',
      scope: 'https://www.googleapis.com/auth/calendar.events',
    });
    const res = mockRes();
    await callbackHandler(callbackReq({ state: 'n', code: 'c' }), res);
    expect(res._location).toBe('https://app.test/settings?calendar=error');
    expect(upsertRan()).toBe(false);
  });
});
