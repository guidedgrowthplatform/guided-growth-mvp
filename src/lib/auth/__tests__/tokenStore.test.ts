import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTokenStoreForTest,
  getFreshToken,
  getToken,
  refreshOnce,
  setSession,
} from '@/lib/auth/tokenStore';

const { refreshSessionMock } = vi.hoisted(() => ({ refreshSessionMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { refreshSession: refreshSessionMock } },
}));

function sessionWithExpiry(token: string, secondsFromNow: number) {
  return {
    access_token: token,
    expires_at: Math.floor((Date.now() + secondsFromNow * 1000) / 1000),
  };
}

describe('tokenStore', () => {
  beforeEach(() => {
    __resetTokenStoreForTest();
    refreshSessionMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('single-flight: N concurrent getFreshToken() near expiry → refreshSession once', async () => {
    // near expiry (< 45s skew) forces refresh
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockResolvedValue({
      data: { session: { access_token: 'fresh' } },
      error: null,
    });

    const results = await Promise.all([
      getFreshToken(),
      getFreshToken(),
      getFreshToken(),
      getFreshToken(),
      getFreshToken(),
    ]);

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['fresh', 'fresh', 'fresh', 'fresh', 'fresh']);
  });

  it('memo cleared after settle: a later call refreshes again (no poison)', async () => {
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockResolvedValue({
      data: { session: { access_token: 'fresh' } },
      error: null,
    });

    await getFreshToken();
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);

    // expiry still near → second standalone call must re-refresh
    await getFreshToken();
    expect(refreshSessionMock).toHaveBeenCalledTimes(2);
  });

  it('getToken() returns sync cached value set via setSession', () => {
    setSession(sessionWithExpiry('cached-tok', 600) as never);
    expect(getToken()).toBe('cached-tok');

    setSession(null);
    expect(getToken()).toBeNull();
  });

  it('getFreshToken returns cached token without refresh when expiry far (> 45s)', async () => {
    setSession(sessionWithExpiry('far-tok', 600) as never);

    const tok = await getFreshToken();

    expect(tok).toBe('far-tok');
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('terminal refresh error (401) → null so authedFetch logs out', async () => {
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthApiError', status: 401, message: 'invalid_grant' },
    });

    await expect(getFreshToken()).resolves.toBeNull();
  });

  it('retryable refresh error (5xx) → keeps current token, never logs out', async () => {
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthApiError', status: 503, message: 'upstream' },
    });

    await expect(getFreshToken()).resolves.toBe('stale');
  });

  it('AuthRetryableFetchError (network) → keeps current token', async () => {
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'network' },
    });

    await expect(getFreshToken()).resolves.toBe('stale');
  });

  it('error with no http status → transient, keeps current token', async () => {
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockResolvedValue({ data: { session: null }, error: { message: 'boom' } });

    await expect(getFreshToken()).resolves.toBe('stale');
  });

  it('refreshSession throws (network) → keeps current token, not terminal', async () => {
    setSession(sessionWithExpiry('stale', 10) as never);
    refreshSessionMock.mockRejectedValue(new Error('network'));

    await expect(refreshOnce()).resolves.toBe('stale');
  });
});
