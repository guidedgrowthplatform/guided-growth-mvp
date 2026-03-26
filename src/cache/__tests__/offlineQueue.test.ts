import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { offlineQueue } from '../offlineQueue';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
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
});
