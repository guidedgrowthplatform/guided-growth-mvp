import type { Session } from '@supabase/supabase-js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setSession, __resetTokenStoreForTest } from '@/lib/auth/tokenStore';
import { supabase } from '@/lib/supabase';
import { offlineQueue } from '../offlineQueue';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), refreshSession: vi.fn() },
    realtime: { setAuth: vi.fn() },
  },
  sessionReady: Promise.resolve(),
}));

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

const refreshSessionMock = supabase.auth.refreshSession as unknown as ReturnType<typeof vi.fn>;

const FAR_FUTURE = 9_999_999_999;
function seedToken(access_token: string): void {
  setSession({ access_token, expires_at: FAR_FUTURE } as unknown as Session);
}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
  refreshSessionMock.mockReset();
  refreshSessionMock.mockResolvedValue({ data: { session: null }, error: null });
  __resetTokenStoreForTest();
  seedToken('tok-default');
});

describe('offlineQueue', () => {
  it('enqueues and retrieves mutations', () => {
    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    expect(offlineQueue.length).toBe(1);

    const queue = offlineQueue.getQueue();
    expect(queue[0].endpoint).toBe('/api/entries/2026-03-15');
    expect(queue[0].method).toBe('PUT');
    expect(queue[0].body).toEqual({ m1: 'yes' });
  });

  it('flush removes successful mutations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();
    expect(offlineQueue.length).toBe(0);
  });

  it('flush re-enqueues on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();
    expect(offlineQueue.length).toBe(1);
  });

  it('flush re-enqueues on 5xx server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();
    expect(offlineQueue.length).toBe(1);
  });

  it('flush drops on genuine 4xx client error (no infinite retry)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();
    expect(offlineQueue.length).toBe(0);
  });

  it('flush requeues on 401/403 — never drops user writes on an auth blip', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();
    expect(offlineQueue.length).toBe(1);
  });

  it('clear removes all entries', () => {
    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    offlineQueue.enqueue('/api/entries/2026-03-16', 'PUT', { m2: 'no' });
    expect(offlineQueue.length).toBe(2);

    offlineQueue.clear();
    expect(offlineQueue.length).toBe(0);
  });

  it('flush attaches Authorization header from the active session token', async () => {
    seedToken('tok-abc');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-abc');
  });

  it('flush omits Authorization header when no session is available', async () => {
    __resetTokenStoreForTest();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('preserves mutations enqueued WHILE a flush is in progress', async () => {
    let resolveFetch: ((value: { ok: boolean; status: number }) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<{ ok: boolean; status: number }>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    const flushPromise = offlineQueue.flush();

    // Drain microtasks so flush reaches and parks on fetch before we enqueue.
    await new Promise((r) => setTimeout(r, 0));

    // Concurrent enqueue mid-flush — must not be lost.
    offlineQueue.enqueue('/api/entries/2026-03-16', 'PUT', { m2: 'no' });

    resolveFetch!({ ok: true, status: 200 });
    await flushPromise;

    expect(offlineQueue.length).toBe(1);
    expect(offlineQueue.getQueue()[0].endpoint).toBe('/api/entries/2026-03-16');
  });

  it('getQueue returns [] and clears the key when localStorage holds corrupt JSON', () => {
    store['lgt_offline_queue'] = '{not valid json';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(offlineQueue.getQueue()).toEqual([]);
    expect(offlineQueue.length).toBe(0);
    expect(store['lgt_offline_queue']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('caps queue length at MAX_QUEUE (500), dropping oldest on overflow', () => {
    for (let i = 0; i < 510; i++) {
      offlineQueue.enqueue(`/api/entries/${i}`, 'PUT', { i });
    }
    expect(offlineQueue.length).toBe(500);
    const queue = offlineQueue.getQueue();
    // Oldest (i=0..9) should have been dropped; newest (i=509) at tail.
    expect((queue[0].body as { i: number }).i).toBe(10);
    expect((queue[queue.length - 1].body as { i: number }).i).toBe(509);
  });

  it('enqueue returns false and does not throw when setItem throws (Safari private mode)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    // Second setItem call (the retry with trimmed queue) also throws.
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const ok = offlineQueue.enqueue('/api/session_log', 'POST', { x: 1 }, 'session_log');
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('enqueue retries with trimmed queue when first setItem throws QuotaExceededError', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Pre-fill queue.
    for (let i = 0; i < 10; i++) {
      offlineQueue.enqueue(`/api/entries/${i}`, 'PUT', { i });
    }
    // Next setItem throws, retry succeeds.
    let calls = 0;
    const realSet = localStorageMock.setItem.getMockImplementation();
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      calls++;
      if (calls === 1) throw new Error('QuotaExceededError');
      // retry — store normally
      store[key] = value;
    });

    const ok = offlineQueue.enqueue('/api/entries/over', 'PUT', { last: true }, 'entry');
    expect(ok).toBe(true);
    expect(calls).toBe(2);
    expect(warnSpy).toHaveBeenCalled();

    // Cleanup
    localStorageMock.setItem.mockImplementation(realSet ?? (() => undefined));
    warnSpy.mockRestore();
  });

  it('persists the kind tag on enqueued items', () => {
    offlineQueue.enqueue('/api/session_log', 'POST', { e: 'navigate' }, 'session_log');
    const queue = offlineQueue.getQueue();
    expect(queue[0].kind).toBe('session_log');
  });

  it('defaults kind to "unknown" when omitted', () => {
    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    const queue = offlineQueue.getQueue();
    expect(queue[0].kind).toBe('unknown');
  });
});
