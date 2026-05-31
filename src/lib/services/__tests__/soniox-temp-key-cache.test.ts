import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTempKeyCacheForTest,
  prefetchTempKey,
  startKeyWarmLoop,
  stopKeyWarmLoop,
  takeTempKey,
} from '@/lib/services/soniox-temp-key-cache';

// hoisted above imports by vitest
vi.mock('@/lib/services/api-auth', () => ({
  getApiBase: () => '',
  getAuthHeaders: async () => ({}),
}));

// Resolves the global fetch microtask chain (real timers).
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

let nowMs = 0;

function mockFetchKey(key: string, ok = true) {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 502,
    json: async () => ({ apiKey: key }),
  }));
}

describe('soniox-temp-key-cache', () => {
  beforeEach(() => {
    __resetTempKeyCacheForTest();
    nowMs = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('prefetch then take returns the cached key once (single-use), re-mints on 2nd take', async () => {
    const fetchMock = mockFetchKey('k1');
    vi.stubGlobal('fetch', fetchMock);

    prefetchTempKey();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const first = await takeTempKey();
    expect(first).toEqual({ apiKey: 'k1', cached: true });

    // cache emptied → live mint
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ apiKey: 'k2' }),
    }));
    const second = await takeTempKey();
    expect(second).toEqual({ apiKey: 'k2', cached: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('discards a key older than the TTL and re-mints', async () => {
    const fetchMock = mockFetchKey('stale');
    vi.stubGlobal('fetch', fetchMock);

    prefetchTempKey();
    await flush();

    // advance past the 240s TTL margin
    nowMs = 241_000;
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ apiKey: 'fresh' }),
    }));

    const taken = await takeTempKey();
    expect(taken).toEqual({ apiKey: 'fresh', cached: false });
  });

  it('de-dupes concurrent prefetch calls into one mint', async () => {
    const fetchMock = mockFetchKey('once');
    vi.stubGlobal('fetch', fetchMock);

    prefetchTempKey();
    prefetchTempKey();
    prefetchTempKey();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('take awaits an in-flight prefetch and consumes it as cached', async () => {
    const fetchMock = mockFetchKey('inflight');
    vi.stubGlobal('fetch', fetchMock);

    prefetchTempKey();
    // do NOT flush — take() races the in-flight prefetch
    const taken = await takeTempKey();

    expect(taken).toEqual({ apiKey: 'inflight', cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('take live-mints (cached:false) when nothing is warmed', async () => {
    const fetchMock = mockFetchKey('cold');
    vi.stubGlobal('fetch', fetchMock);

    const taken = await takeTempKey();
    expect(taken).toEqual({ apiKey: 'cold', cached: false });
  });

  it('prefetch swallows a failed mint and take falls through to a live mint', async () => {
    const fetchMock = mockFetchKey('unused', false); // ok:false → fetchTempKey throws
    vi.stubGlobal('fetch', fetchMock);

    prefetchTempKey();
    await flush();

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ apiKey: 'live' }),
    }));
    const taken = await takeTempKey();
    expect(taken).toEqual({ apiKey: 'live', cached: false });
  });

  it('never caches an empty apiKey — re-mints instead', async () => {
    const fetchMock = mockFetchKey(''); // ok:200 but empty key
    vi.stubGlobal('fetch', fetchMock);

    prefetchTempKey();
    await flush();

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ apiKey: 'real' }),
    }));
    const taken = await takeTempKey();
    expect(taken).toEqual({ apiKey: 'real', cached: false });
  });

  it('warm loop prefetches on start and refills after each consume', async () => {
    const fetchMock = mockFetchKey('w1');
    vi.stubGlobal('fetch', fetchMock);

    startKeyWarmLoop();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1); // immediate prefetch

    const first = await takeTempKey();
    expect(first).toEqual({ apiKey: 'w1', cached: true });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2); // refilled for next utterance

    stopKeyWarmLoop();
    const second = await takeTempKey();
    expect(second).toEqual({ apiKey: 'w1', cached: true }); // consumes the refill
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2); // no further refill after stop
  });
});
