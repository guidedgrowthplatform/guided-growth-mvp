import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// google.ts imports `../db.js` — mock the pool so these unit tests need no DB.
vi.mock('../../db.js', () => ({ default: { query: vi.fn() } }));

import pool from '../../db.js';
const {
  refreshAccessToken,
  exchangeCodeForTokens,
  getValidAccessToken,
  CalendarNotConnectedError,
  CalendarDisabledError,
  CalendarReauthRequiredError,
} = await import('../google.js');

const query = pool.query as unknown as ReturnType<typeof vi.fn>;

function fetchOnce(res: { ok: boolean; status: number; json?: unknown; text?: string }) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: res.ok,
    status: res.status,
    json: async () => res.json,
    text: async () => res.text ?? '',
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  query.mockReset();
  global.fetch = vi.fn();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('refreshAccessToken', () => {
  it('maps invalid_grant (400) to CalendarReauthRequiredError', async () => {
    fetchOnce({ ok: false, status: 400, text: JSON.stringify({ error: 'invalid_grant' }) });
    await expect(refreshAccessToken('rt')).rejects.toBeInstanceOf(CalendarReauthRequiredError);
  });

  it('throws a generic error on a non-invalid_grant 400', async () => {
    fetchOnce({ ok: false, status: 400, text: JSON.stringify({ error: 'invalid_scope' }) });
    await expect(refreshAccessToken('rt')).rejects.not.toBeInstanceOf(CalendarReauthRequiredError);
  });

  it('throws a generic error on a 500', async () => {
    fetchOnce({ ok: false, status: 500, text: '' });
    await expect(refreshAccessToken('rt')).rejects.toThrow(/500/);
  });

  it('throws when client credentials are not configured', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    await expect(refreshAccessToken('rt')).rejects.toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('returns the parsed token on success', async () => {
    fetchOnce({ ok: true, status: 200, json: { access_token: 'at', expires_in: 3600 } });
    await expect(refreshAccessToken('rt')).resolves.toMatchObject({
      access_token: 'at',
      expires_in: 3600,
    });
  });

  it('rejects a malformed success body', async () => {
    fetchOnce({ ok: true, status: 200, json: { access_token: 'at' } }); // no expires_in
    await expect(refreshAccessToken('rt')).rejects.toThrow(/malformed/);
  });
});

describe('exchangeCodeForTokens', () => {
  it('sends grant_type=authorization_code with code + redirect_uri', async () => {
    fetchOnce({ ok: true, status: 200, json: { access_token: 'at', expires_in: 3600 } });
    await exchangeCodeForTokens('the-code', 'https://app/api/calendar/oauth/callback');
    const body = String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=the-code');
    expect(body).toContain(encodeURIComponent('https://app/api/calendar/oauth/callback'));
  });

  it('returns refresh_token + scope on success', async () => {
    fetchOnce({
      ok: true,
      status: 200,
      json: { access_token: 'at', expires_in: 3600, refresh_token: 'rt', scope: 'a b' },
    });
    await expect(exchangeCodeForTokens('c', 'https://app/cb')).resolves.toMatchObject({
      refresh_token: 'rt',
      scope: 'a b',
    });
  });

  it('throws on a bad code (400)', async () => {
    fetchOnce({ ok: false, status: 400, text: JSON.stringify({ error: 'invalid_grant' }) });
    await expect(exchangeCodeForTokens('c', 'https://app/cb')).rejects.toThrow(/400/);
  });

  it('throws on a 500', async () => {
    fetchOnce({ ok: false, status: 500, text: '' });
    await expect(exchangeCodeForTokens('c', 'https://app/cb')).rejects.toThrow(/500/);
  });

  it('throws when client credentials are not configured', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    await expect(exchangeCodeForTokens('c', 'https://app/cb')).rejects.toThrow(/GOOGLE_CLIENT/);
  });

  it('rejects a malformed success body', async () => {
    fetchOnce({ ok: true, status: 200, json: { refresh_token: 'rt' } }); // no access_token
    await expect(exchangeCodeForTokens('c', 'https://app/cb')).rejects.toThrow(/malformed/);
  });
});

describe('getValidAccessToken', () => {
  it('throws CalendarNotConnectedError when no row', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getValidAccessToken('anon')).rejects.toBeInstanceOf(CalendarNotConnectedError);
  });

  it('throws CalendarNotConnectedError when refresh_token is missing', async () => {
    query.mockResolvedValueOnce({ rows: [{ refresh_token: null, enabled: true }] });
    await expect(getValidAccessToken('anon')).rejects.toBeInstanceOf(CalendarNotConnectedError);
  });

  it('throws CalendarDisabledError when enabled is false', async () => {
    query.mockResolvedValueOnce({ rows: [{ refresh_token: 'rt', enabled: false }] });
    await expect(getValidAccessToken('anon')).rejects.toBeInstanceOf(CalendarDisabledError);
  });

  it('returns the cached token without refreshing when it is still valid', async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    query.mockResolvedValueOnce({
      rows: [
        { access_token: 'cached', refresh_token: 'rt', token_expires_at: future, enabled: true },
      ],
    });
    await expect(getValidAccessToken('anon')).resolves.toBe('cached');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes when the token is expired and persists the new access token', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ access_token: 'old', refresh_token: 'rt', token_expires_at: null, enabled: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    fetchOnce({ ok: true, status: 200, json: { access_token: 'fresh', expires_in: 3600 } });

    await expect(getValidAccessToken('anon')).resolves.toBe('fresh');
    const update = query.mock.calls[1];
    expect(update[1][1]).toBe('fresh'); // $2 access_token
  });

  it('persists a rotated refresh token when Google returns one', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ access_token: null, refresh_token: 'rt', token_expires_at: null, enabled: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    fetchOnce({
      ok: true,
      status: 200,
      json: { access_token: 'fresh', expires_in: 3600, refresh_token: 'rotated' },
    });

    await getValidAccessToken('anon');
    expect(query.mock.calls[1][1][3]).toBe('rotated'); // $4 rotated refresh token
  });

  it('passes null for the rotated token so COALESCE keeps the current one', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ access_token: null, refresh_token: 'rt', token_expires_at: null, enabled: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    fetchOnce({ ok: true, status: 200, json: { access_token: 'fresh', expires_in: 3600 } });

    await getValidAccessToken('anon');
    expect(query.mock.calls[1][1][3]).toBeNull(); // $4 null → COALESCE keeps existing
  });

  it('refreshes when the token is inside the 60s expiry skew window', async () => {
    const almost = new Date(Date.now() + 30_000).toISOString(); // < 60s skew → treat as stale
    query
      .mockResolvedValueOnce({
        rows: [
          { access_token: 'old', refresh_token: 'rt', token_expires_at: almost, enabled: true },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    fetchOnce({ ok: true, status: 200, json: { access_token: 'fresh', expires_in: 3600 } });

    await expect(getValidAccessToken('anon')).resolves.toBe('fresh');
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
