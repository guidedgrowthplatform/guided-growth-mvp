/**
 * Settle-token rules for beat-opener activations (the B4 double-activation
 * race), plus the pool claim serialization that pairs with them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyOpenerPlayFailure, createActivationTracker } from '../openerActivation';
import {
  claimPreloadedClip,
  preloadOpenerClips,
  resetOpenerPreloadPool,
} from '../openerPreloadPool';

describe('createActivationTracker', () => {
  it('lets the current activation settle exactly once', () => {
    const tracker = createActivationTracker();
    const a = tracker.begin();
    expect(a.isCurrent()).toBe(true);
    expect(a.isSettled()).toBe(false);
    expect(a.settle()).toBe(true);
    expect(a.isSettled()).toBe(true);
    // Second settle is a no-op: side effects must not run twice.
    expect(a.settle()).toBe(false);
  });

  it('makes every previous activation stale when a new one begins', () => {
    const tracker = createActivationTracker();
    const a1 = tracker.begin();
    const a2 = tracker.begin();
    expect(a1.isCurrent()).toBe(false);
    expect(a2.isCurrent()).toBe(true);
    // A stale activation may record itself settled but must not act.
    expect(a1.settle()).toBe(false);
    expect(a1.isSettled()).toBe(true);
    // The current activation is untouched by the stale settle.
    expect(a2.isSettled()).toBe(false);
    expect(a2.settle()).toBe(true);
  });

  it('B4 regression sequence: run #1 cleanup then run #2 arm — the late run #1 error can never settle run #2', () => {
    const tracker = createActivationTracker();
    // Effect run #1 (strict-mode first pass).
    const a1 = tracker.begin();
    // Cleanup #1: settles activation #1 (it is still current) — side effects OK.
    expect(a1.settle()).toBe(true);
    // Effect run #2 arms the real activation.
    const a2 = tracker.begin();
    // Run #1's play() AbortError lands now, late. Its activation is settled,
    // so the failure path must classify as 'ignore' — never settle a2.
    expect(
      classifyOpenerPlayFailure({
        errorName: 'AbortError',
        isCurrent: a1.isCurrent(),
        isSettled: a1.isSettled(),
        teardownAborted: true,
        retriesLeft: 2,
      }),
    ).toBe('ignore');
    expect(a2.isSettled()).toBe(false);
  });
});

describe('classifyOpenerPlayFailure', () => {
  const live = { isCurrent: true, isSettled: false, teardownAborted: false };

  it('ignores rejections that belong to a settled activation', () => {
    expect(
      classifyOpenerPlayFailure({
        errorName: 'AbortError',
        isCurrent: true,
        isSettled: true,
        teardownAborted: false,
        retriesLeft: 2,
      }),
    ).toBe('ignore');
  });

  it('ignores rejections that belong to a stale activation', () => {
    expect(
      classifyOpenerPlayFailure({
        errorName: 'NotAllowedError',
        isCurrent: false,
        isSettled: false,
        teardownAborted: false,
        retriesLeft: 2,
      }),
    ).toBe('ignore');
  });

  it('ignores rejections from our own teardown abort', () => {
    expect(
      classifyOpenerPlayFailure({
        errorName: 'AbortError',
        isCurrent: true,
        isSettled: false,
        teardownAborted: true,
        retriesLeft: 2,
      }),
    ).toBe('ignore');
  });

  it('re-arms (retries) an AbortError on the live activation while retries remain', () => {
    expect(classifyOpenerPlayFailure({ ...live, errorName: 'AbortError', retriesLeft: 2 })).toBe(
      'retry',
    );
    expect(classifyOpenerPlayFailure({ ...live, errorName: 'AbortError', retriesLeft: 1 })).toBe(
      'retry',
    );
  });

  it('settles an AbortError once retries are exhausted', () => {
    expect(classifyOpenerPlayFailure({ ...live, errorName: 'AbortError', retriesLeft: 0 })).toBe(
      'settle',
    );
  });

  it('settles terminal failures (NotAllowed survived the gesture fallback, decode errors, unknowns)', () => {
    expect(
      classifyOpenerPlayFailure({ ...live, errorName: 'NotAllowedError', retriesLeft: 2 }),
    ).toBe('settle');
    expect(
      classifyOpenerPlayFailure({ ...live, errorName: 'NotSupportedError', retriesLeft: 2 }),
    ).toBe('settle');
    expect(classifyOpenerPlayFailure({ ...live, errorName: null, retriesLeft: 2 })).toBe('settle');
  });
});

// ─── Pool claim serialization ────────────────────────────────────────────────

type FakeListener = () => void;

class FakeAudio {
  src = '';
  preload = '';
  private listeners = new Map<string, Set<FakeListener>>();
  addEventListener(type: string, fn: FakeListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: FakeListener) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  load() {}
}

describe('claimPreloadedClip', () => {
  afterEach(() => {
    resetOpenerPreloadPool();
    vi.unstubAllGlobals();
  });

  function preloadOne(src: string): FakeAudio {
    const created: FakeAudio[] = [];
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    preloadOpenerClips([src]);
    return created[0];
  }

  it('hands the warm element to one consumer at a time', () => {
    const el = preloadOne('/voice/a.mp3');
    const first = claimPreloadedClip('/voice/a.mp3');
    expect(first).not.toBeNull();
    expect(first!.el).toBe(el as unknown as HTMLAudioElement);
    // Second concurrent consumer gets null → falls back to a fresh element.
    expect(claimPreloadedClip('/voice/a.mp3')).toBeNull();
    // Release returns the element; the next activation can claim it again.
    first!.release();
    expect(claimPreloadedClip('/voice/a.mp3')).not.toBeNull();
  });

  it('release is idempotent per claim and cannot free a later claim', () => {
    preloadOne('/voice/b.mp3');
    const first = claimPreloadedClip('/voice/b.mp3')!;
    first.release();
    const second = claimPreloadedClip('/voice/b.mp3')!;
    // A duplicate release of the FIRST claim must not unclaim the second.
    first.release();
    expect(claimPreloadedClip('/voice/b.mp3')).toBeNull();
    second.release();
    expect(claimPreloadedClip('/voice/b.mp3')).not.toBeNull();
  });

  it('reflects readiness live and returns null for failed or unknown clips', () => {
    const el = preloadOne('/voice/c.mp3');
    const claim = claimPreloadedClip('/voice/c.mp3')!;
    expect(claim.ready).toBe(false);
    el.dispatch('canplaythrough');
    expect(claim.ready).toBe(true);
    claim.release();

    expect(claimPreloadedClip('/voice/never-preloaded.mp3')).toBeNull();

    const el2 = preloadOne('/voice/d.mp3');
    el2.dispatch('error');
    expect(claimPreloadedClip('/voice/d.mp3')).toBeNull();
  });
});
