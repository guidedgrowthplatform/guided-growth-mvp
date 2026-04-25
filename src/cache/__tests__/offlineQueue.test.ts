import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { offlineQueue } from '../offlineQueue';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
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

const getSessionMock = supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: null } });
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

  it('flush drops on 4xx client error (no infinite retry)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();
    expect(offlineQueue.length).toBe(0);
  });

  it('clear removes all entries', () => {
    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    offlineQueue.enqueue('/api/entries/2026-03-16', 'PUT', { m2: 'no' });
    expect(offlineQueue.length).toBe(2);

    offlineQueue.clear();
    expect(offlineQueue.length).toBe(0);
  });

  it('flush attaches Authorization header from the active Supabase session', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    offlineQueue.enqueue('/api/entries/2026-03-15', 'PUT', { m1: 'yes' });
    await offlineQueue.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-abc');
  });

  it('flush omits Authorization header when no session is available', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
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

    // Yield so flush can call fetch and start awaiting.
    await Promise.resolve();
    await Promise.resolve();

    // Concurrent enqueue mid-flush — must not be lost.
    offlineQueue.enqueue('/api/entries/2026-03-16', 'PUT', { m2: 'no' });

    resolveFetch!({ ok: true, status: 200 });
    await flushPromise;

    expect(offlineQueue.length).toBe(1);
    expect(offlineQueue.getQueue()[0].endpoint).toBe('/api/entries/2026-03-16');
  });

  it('getQueue returns [] when localStorage holds corrupt JSON', () => {
    store['lgt_offline_queue'] = '{not valid json';
    expect(offlineQueue.getQueue()).toEqual([]);
    expect(offlineQueue.length).toBe(0);
  });
});
