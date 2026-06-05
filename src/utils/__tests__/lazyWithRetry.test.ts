import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importWithRetry, isChunkLoadError } from '../lazyWithRetry';

const RELOAD_FLAG = 'gg:chunk-reload-attempted';
const FAST = { retries: 2, baseDelayMs: 0 };

function mockSessionStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn((k: string) => void store.delete(k)),
  };
}

let reload: ReturnType<typeof vi.fn>;
let session: ReturnType<typeof mockSessionStorage>;

beforeEach(() => {
  reload = vi.fn();
  session = mockSessionStorage();
  vi.stubGlobal('window', { location: { reload } });
  vi.stubGlobal('sessionStorage', session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const chunkError = () =>
  new Error('Failed to fetch dynamically imported module: https://x/HomePage-abc.js');

function isPending(p: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  return Promise.race([
    p.then(() => false).catch(() => false),
    new Promise<typeof marker>((r) => setTimeout(() => r(marker), 10)).then(() => true),
  ]);
}

describe('importWithRetry', () => {
  it('resolves on first try without retry or reload', async () => {
    const factory = vi.fn().mockResolvedValue({ default: 'ok' });
    await expect(importWithRetry(factory, FAST)).resolves.toEqual({ default: 'ok' });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('retries a transient failure then resolves', async () => {
    const factory = vi
      .fn()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValue({ default: 'ok' });
    await expect(importWithRetry(factory, FAST)).resolves.toEqual({ default: 'ok' });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
    expect(session.store.get(RELOAD_FLAG)).toBeUndefined();
  });

  it('reloads exactly once on a persistent chunk error and stays pending', async () => {
    const factory = vi.fn().mockRejectedValue(chunkError());
    const p = importWithRetry(factory, FAST);
    await expect(isPending(p)).resolves.toBe(true);
    expect(factory).toHaveBeenCalledTimes(3);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(session.store.get(RELOAD_FLAG)).toBe('1');
  });

  it('does not reload again when the guard is already set; re-throws', async () => {
    session.store.set(RELOAD_FLAG, '1');
    const factory = vi.fn().mockRejectedValue(chunkError());
    await expect(importWithRetry(factory, FAST)).rejects.toThrow(/dynamically imported module/);
    expect(reload).not.toHaveBeenCalled();
  });

  it('fails fast on a non-chunk error without retry or reload', async () => {
    const factory = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(importWithRetry(factory, FAST)).rejects.toThrow('boom');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(session.setItem).not.toHaveBeenCalled();
  });

  it('clears the guard on success (re-arms for a later deploy)', async () => {
    session.store.set(RELOAD_FLAG, '1');
    const factory = vi.fn().mockResolvedValue({ default: 'ok' });
    await importWithRetry(factory, FAST);
    expect(session.store.get(RELOAD_FLAG)).toBeUndefined();
    expect(reload).not.toHaveBeenCalled();
  });

  it('still reloads once when sessionStorage throws (private mode)', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    const factory = vi.fn().mockRejectedValue(chunkError());
    const p = importWithRetry(factory, FAST);
    await expect(isPending(p)).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('isChunkLoadError', () => {
  const hits = [
    'Failed to fetch dynamically imported module: https://x/HomePage-abc.js',
    'error loading dynamically imported module: https://x/a.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/a.css',
  ];
  it.each(hits)('matches %s', (msg) => {
    expect(isChunkLoadError(new Error(msg))).toBe(true);
  });

  it.each([new Error('boom'), 'not an error', null, undefined, { message: 'x' }])(
    'rejects non-chunk value %s',
    (val) => {
      expect(isChunkLoadError(val)).toBe(false);
    },
  );
});
