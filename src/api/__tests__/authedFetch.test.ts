import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authedFetch } from '@/api/authedFetch';

const { getTokenMock, getFreshTokenMock, refreshOnceMock, signOutMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn(),
  getFreshTokenMock: vi.fn(),
  refreshOnceMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: signOutMock } },
  sessionReady: Promise.resolve(),
}));
vi.mock('@/lib/auth/tokenStore', () => ({
  getToken: getTokenMock,
  getFreshToken: getFreshTokenMock,
  refreshOnce: refreshOnceMock,
}));

function res(status: number) {
  return { status } as Response;
}

describe('authedFetch', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    getFreshTokenMock.mockReset();
    refreshOnceMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('401 then refresh success → fetch twice, second carries new Bearer, returns 200', async () => {
    getTokenMock.mockReturnValue('old');
    refreshOnceMock.mockResolvedValue('new');

    const fetchMock = vi.fn().mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const out = await authedFetch('/api/x', { method: 'POST' });

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0][1].headers ?? {}) as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1][1].headers ?? {}) as Record<string, string>;
    expect(firstHeaders.Authorization).toBe('Bearer old');
    expect(secondHeaders.Authorization).toBe('Bearer new');
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('401 with refreshOnce→null AND token present → signOut local once, no retry, original 401 returned', async () => {
    getTokenMock.mockReturnValue('old');
    refreshOnceMock.mockResolvedValue(null);

    const fetchMock = vi.fn().mockResolvedValueOnce(res(401));
    vi.stubGlobal('fetch', fetchMock);

    const out = await authedFetch('/api/x');

    expect(out.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('401 with no token (guest) → no signOut, no retry, 401 returned', async () => {
    getTokenMock.mockReturnValue(null);
    getFreshTokenMock.mockResolvedValue(null);
    refreshOnceMock.mockResolvedValue(null);

    const fetchMock = vi.fn().mockResolvedValueOnce(res(401));
    vi.stubGlobal('fetch', fetchMock);

    const out = await authedFetch('/api/x');

    expect(out.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('non-401 → returned as-is, no refresh, no signOut', async () => {
    getTokenMock.mockReturnValue('old');

    const fetchMock = vi.fn().mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const out = await authedFetch('/api/x');

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshOnceMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
