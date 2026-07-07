import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const voiceConfigMock = vi.hoisted(() => ({ SONIOX_PREWARM: true }));
vi.mock('@/config/voiceConfig', () => voiceConfigMock);

import {
  __resetSonioxPrewarmForTest,
  claimPrewarmedSocket,
  hasPrewarmedSocket,
  prewarmSoniox,
  setPrewarmSocketOpener,
} from '@/lib/services/soniox-prewarm';
import type { SonioxSocket } from '@/lib/services/soniox-stream';
import { __resetTempKeyCacheForTest, takeTempKey } from '@/lib/services/soniox-temp-key-cache';

vi.mock('@/lib/services/api-auth', () => ({
  getApiBase: () => '',
  getAuthHeaders: async () => ({}),
}));

// Resolves the global fetch microtask chain (real timers).
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function mockFetchKey(key: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ apiKey: key }),
  }));
}

// FakeSocket mirrors soniox-stream.test.ts's harness so behavior matches the
// real onOpen/onError/onClose contract the browser layer relies on.
class FakeSocket implements SonioxSocket {
  sent: Array<string | ArrayBufferLike> = [];
  closed = false;
  private openCb?: () => void;
  private msgCb?: (data: string) => void;
  private errCb?: (e: unknown) => void;
  private closeCb?: (code?: number) => void;

  send(data: string | ArrayBufferLike): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
    this.closeCb?.();
  }
  onOpen(cb: () => void): void {
    this.openCb = cb;
  }
  onMessage(cb: (data: string) => void): void {
    this.msgCb = cb;
  }
  onError(cb: (e: unknown) => void): void {
    this.errCb = cb;
  }
  onClose(cb: (code?: number) => void): void {
    this.closeCb = cb;
  }

  emitOpen(): void {
    this.openCb?.();
  }
  emitError(e?: unknown): void {
    this.errCb?.(e);
  }
  emitClose(code?: number): void {
    this.closeCb?.(code);
  }
}

describe('soniox-prewarm', () => {
  beforeEach(() => {
    voiceConfigMock.SONIOX_PREWARM = true;
    __resetTempKeyCacheForTest();
    __resetSonioxPrewarmForTest();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    __resetSonioxPrewarmForTest();
    __resetTempKeyCacheForTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('flag off: prewarmSoniox() never mints a key or opens a socket', async () => {
    voiceConfigMock.SONIOX_PREWARM = false;
    const fetchMock = mockFetchKey('unused');
    vi.stubGlobal('fetch', fetchMock);
    const opener = vi.fn(() => new FakeSocket());
    setPrewarmSocketOpener(opener);

    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(opener).not.toHaveBeenCalled();
    expect(hasPrewarmedSocket()).toBe(false);
    expect(claimPrewarmedSocket()).toBeNull();
  });

  it('mints a fresh key into the shared cache so the next takeTempKey() is cached:true', async () => {
    const fetchMock = mockFetchKey('prewarmed-key');
    vi.stubGlobal('fetch', fetchMock);
    setPrewarmSocketOpener(() => new FakeSocket());

    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const taken = await takeTempKey();
    expect(taken).toEqual({ apiKey: 'prewarmed-key', cached: true });
  });

  it('pre-opens a socket and the next session claims it once OPEN', async () => {
    vi.stubGlobal('fetch', mockFetchKey('k'));
    let created: FakeSocket | null = null;
    setPrewarmSocketOpener(() => {
      created = new FakeSocket();
      return created;
    });

    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);

    expect(hasPrewarmedSocket()).toBe(false); // not open yet
    created!.emitOpen();
    expect(hasPrewarmedSocket()).toBe(true);

    const claimed = claimPrewarmedSocket();
    expect(claimed).toBe(created);
    // Consumed — a second claim in the same session finds nothing.
    expect(claimPrewarmedSocket()).toBeNull();
    expect(hasPrewarmedSocket()).toBe(false);
  });

  it('expires and closes an unclaimed prewarmed socket after its TTL, falling back cleanly', async () => {
    vi.stubGlobal('fetch', mockFetchKey('k'));
    let created: FakeSocket | null = null;
    setPrewarmSocketOpener(() => {
      created = new FakeSocket();
      return created;
    });

    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);
    created!.emitOpen();
    expect(hasPrewarmedSocket()).toBe(true);

    await vi.advanceTimersByTimeAsync(20_000);

    expect(created!.closed).toBe(true);
    expect(hasPrewarmedSocket()).toBe(false);
    expect(claimPrewarmedSocket()).toBeNull();
  });

  it('a prewarmed socket that errors/closes before being claimed is discarded, not handed off', async () => {
    vi.stubGlobal('fetch', mockFetchKey('k'));
    let created: FakeSocket | null = null;
    setPrewarmSocketOpener(() => {
      created = new FakeSocket();
      return created;
    });

    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);
    created!.emitOpen();
    expect(hasPrewarmedSocket()).toBe(true);

    created!.emitError(new Event('error'));

    expect(hasPrewarmedSocket()).toBe(false);
    expect(claimPrewarmedSocket()).toBeNull();
  });

  it('swallows a key-mint failure and a socket-open throw without surfacing to the caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })),
    );
    setPrewarmSocketOpener(() => {
      throw new Error('ws construction failed');
    });

    expect(() => prewarmSoniox()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(hasPrewarmedSocket()).toBe(false);
    expect(claimPrewarmedSocket()).toBeNull();
  });

  it('does not re-open a second socket while a fresh one is already pending', async () => {
    vi.stubGlobal('fetch', mockFetchKey('k'));
    const opener = vi.fn(() => new FakeSocket());
    setPrewarmSocketOpener(opener);

    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);
    prewarmSoniox();
    await vi.advanceTimersByTimeAsync(0);

    expect(opener).toHaveBeenCalledTimes(1);
  });
});
