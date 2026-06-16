// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn(() => false);
const keepAwake = vi.fn(async () => undefined);
const allowSleep = vi.fn(async () => undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: () => keepAwake(), allowSleep: () => allowSleep() },
}));

async function load() {
  vi.resetModules();
  return import('../keepAwake');
}

describe('keepAwake — native', () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
    keepAwake.mockClear();
    allowSleep.mockClear();
  });

  it('acquire calls KeepAwake.keepAwake', async () => {
    const { acquireWakeLock } = await load();
    await acquireWakeLock();
    expect(keepAwake).toHaveBeenCalledTimes(1);
  });

  it('release calls KeepAwake.allowSleep', async () => {
    const { releaseWakeLock } = await load();
    await releaseWakeLock();
    expect(allowSleep).toHaveBeenCalledTimes(1);
  });
});

describe('keepAwake — web', () => {
  const sentinel = { release: vi.fn(async () => undefined), addEventListener: vi.fn() };
  const request = vi.fn(async () => sentinel);

  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    request.mockClear();
    sentinel.release.mockClear();
    (navigator as unknown as { wakeLock: unknown }).wakeLock = { request };
  });
  afterEach(() => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
  });

  it('acquire requests a screen wake-lock sentinel', async () => {
    const { acquireWakeLock } = await load();
    await acquireWakeLock();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('release frees the held sentinel', async () => {
    const { acquireWakeLock, releaseWakeLock } = await load();
    await acquireWakeLock();
    await releaseWakeLock();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('reacquireIfActive re-requests only when active', async () => {
    const mod = await load();
    await mod.reacquireIfActive();
    expect(request).not.toHaveBeenCalled();
    await mod.acquireWakeLock();
    await mod.suspendWakeLock();
    await mod.reacquireIfActive();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('never throws when wakeLock is unsupported', async () => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    const { acquireWakeLock } = await load();
    await expect(acquireWakeLock()).resolves.toBeUndefined();
  });
});
