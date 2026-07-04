/** @vitest-environment jsdom */

/**
 * startOpenerFromGesture, the Get-started tap starts the first onboarding
 * clip synchronously in its own gesture frame (no autoplay, no deferred
 * random-tap start). These tests lock the mechanics: synchronous play() on
 * the pooled element, a started promise that reports the outcome, and a
 * release that returns the element to the pool.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blessOpenerClipsInGesture, startOpenerFromGesture } from '../openerGestureStart';
import {
  claimPreloadedClip,
  preloadOpenerClips,
  resetOpenerPreloadPool,
} from '../openerPreloadPool';

type PlayBehavior = 'pending' | 'resolve' | DOMException;

class FakeAudio {
  static instances: FakeAudio[] = [];
  /** Consumed per play() call, across all instances. Default: 'pending'. */
  static playBehaviors: PlayBehavior[] = [];
  static reset() {
    FakeAudio.instances = [];
    FakeAudio.playBehaviors = [];
  }

  src: string;
  preload = '';
  muted = false;
  currentTime = 0;
  paused = true;
  playCalls = 0;
  private pendingResolve: (() => void) | null = null;
  private listeners = new Map<string, Set<() => void>>();

  constructor(src?: string) {
    this.src = src ?? '';
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls += 1;
    const behavior = FakeAudio.playBehaviors.shift() ?? 'pending';
    if (behavior === 'resolve') {
      this.paused = false;
      return Promise.resolve();
    }
    if (behavior instanceof DOMException) {
      return Promise.reject(behavior);
    }
    return new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  resolvePlay() {
    this.paused = false;
    this.pendingResolve?.();
    this.pendingResolve = null;
  }

  pause() {
    this.paused = true;
  }

  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  load() {}
}

beforeEach(() => {
  FakeAudio.reset();
  resetOpenerPreloadPool();
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startOpenerFromGesture', () => {
  it('claims the pooled element and calls play() synchronously in the same frame', async () => {
    preloadOpenerClips(['/voice/splash_welcome.mp3']);
    const pooledEl = FakeAudio.instances[0];
    pooledEl.dispatch('canplaythrough');

    const handle = startOpenerFromGesture('/voice/splash_welcome.mp3');

    // Same element, played synchronously (no await before play(): awaiting
    // would leave the gesture frame and forfeit the activation).
    expect(handle.el).toBe(pooledEl as unknown as HTMLAudioElement);
    expect(pooledEl.playCalls).toBe(1);
    expect(FakeAudio.instances.length).toBe(1);

    // While held, no other consumer can claim the element.
    expect(claimPreloadedClip('/voice/splash_welcome.mp3')).toBeNull();

    pooledEl.resolvePlay();
    await expect(handle.started).resolves.toBe(true);
  });

  it('falls back to a fresh element when the pool has no entry', () => {
    const handle = startOpenerFromGesture('/voice/uncached.mp3');
    expect(FakeAudio.instances.length).toBe(1);
    expect(FakeAudio.instances[0].src).toBe('/voice/uncached.mp3');
    expect(FakeAudio.instances[0].preload).toBe('auto');
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    expect(handle.el).toBe(FakeAudio.instances[0] as unknown as HTMLAudioElement);
  });

  it('started resolves false (never rejects) when the gesture play() is blocked', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    FakeAudio.playBehaviors = [new DOMException('no gesture', 'NotAllowedError')];

    const handle = startOpenerFromGesture('/voice/splash_welcome.mp3');

    await expect(handle.started).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('release() stops, rewinds, and returns the element to the pool (idempotent)', () => {
    preloadOpenerClips(['/voice/splash_welcome.mp3']);
    const pooledEl = FakeAudio.instances[0];
    pooledEl.dispatch('canplaythrough');

    const handle = startOpenerFromGesture('/voice/splash_welcome.mp3');
    pooledEl.resolvePlay();
    pooledEl.currentTime = 3.2;

    handle.release();
    expect(pooledEl.paused).toBe(true);
    expect(pooledEl.currentTime).toBe(0);

    // Back in the pool: the next consumer can claim the same warm element.
    const reclaim = claimPreloadedClip('/voice/splash_welcome.mp3');
    expect(reclaim?.el).toBe(pooledEl as unknown as HTMLAudioElement);

    // A second release is a no-op, it must not unclaim the new consumer.
    handle.release();
    expect(claimPreloadedClip('/voice/splash_welcome.mp3')).toBeNull();
    reclaim?.release();
  });
});

describe('blessOpenerClipsInGesture (B28)', () => {
  it('play()+pause()s each POOLED element and releases it for the beat to claim', () => {
    FakeAudio.playBehaviors = ['resolve', 'resolve'];
    blessOpenerClipsInGesture(['/voice/a.mp3', '/voice/b.mp3']);
    expect(FakeAudio.instances).toHaveLength(2);
    for (const el of FakeAudio.instances) {
      expect(el.playCalls).toBe(1);
      expect(el.paused).toBe(true);
      expect(el.currentTime).toBe(0);
    }
    // Released: the beat's own claim gets the SAME blessed element.
    const claimed = claimPreloadedClip('/voice/a.mp3');
    expect(claimed?.el).toBe(FakeAudio.instances[0] as unknown as HTMLAudioElement);
  });

  it('tolerates a rejected play() (stays unblessed; the affordance covers it)', () => {
    FakeAudio.playBehaviors = [new DOMException('no gesture', 'NotAllowedError'), 'resolve'];
    expect(() => blessOpenerClipsInGesture(['/voice/a.mp3', '/voice/b.mp3'])).not.toThrow();
    expect(claimPreloadedClip('/voice/b.mp3')).not.toBeNull();
  });

  it('skips clips already claimed by someone else', () => {
    FakeAudio.playBehaviors = ['pending', 'resolve'];
    preloadOpenerClips(['/voice/a.mp3']);
    const held = claimPreloadedClip('/voice/a.mp3');
    expect(held).not.toBeNull();
    blessOpenerClipsInGesture(['/voice/a.mp3']);
    // The held element was never play()ed by the bless.
    expect((held!.el as unknown as FakeAudio).playCalls).toBe(0);
  });
});
