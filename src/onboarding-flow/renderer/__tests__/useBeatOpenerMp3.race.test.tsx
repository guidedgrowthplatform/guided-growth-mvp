/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Regression tests for the B4/B14 playback race: the hook's effect runs twice
 * for one logical activation (React strict-mode double invoke) and run #1's
 * cleanup pause() makes its pending play() reject with AbortError AFTER run #2
 * has armed. Before the activation tokens, that late rejection settled run #2
 * → every MP3 opener was marked done with zero `playing` events.
 */
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadOpenerClips, resetOpenerPreloadPool } from '../openerPreloadPool';
import { useBeatOpenerMp3, type BeatOpenerMp3State } from '../useBeatOpenerMp3';

// ─── Controllable HTMLAudioElement stand-in ─────────────────────────────────

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
  duration = 10;
  paused = true;
  error: MediaError | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playCalls = 0;
  private pendingResolve: (() => void) | null = null;
  private pendingReject: ((err: unknown) => void) | null = null;
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
    return new Promise<void>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
    });
  }

  /** Resolve an in-flight play() as the browser would on playback start. */
  resolvePlay() {
    this.paused = false;
    this.pendingResolve?.();
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  /** Chrome semantics: pause() rejects a pending play() with AbortError. */
  pause() {
    this.paused = true;
    const reject = this.pendingReject;
    this.pendingResolve = null;
    this.pendingReject = null;
    reject?.(
      new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'),
    );
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

// ─── Probe harness (createRoot + act, matching the repo's hook-test style) ──

let container: HTMLDivElement;
let root: Root;
let state: BeatOpenerMp3State | null = null;

function Probe({ src, active }: { src: string | null; active: boolean }) {
  state = useBeatOpenerMp3(src, active);
  return null;
}

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
}

beforeEach(() => {
  FakeAudio.reset();
  resetOpenerPreloadPool();
  vi.stubGlobal('Audio', FakeAudio);
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  state = null;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBeatOpenerMp3 double-activation race (B4)', () => {
  it('strict-mode double effect: run #1 late AbortError never settles run #2; the clip still plays', async () => {
    await render(
      <StrictMode>
        <Probe src="/voice/x.mp3" active />
      </StrictMode>,
    );

    // Two effect runs → two fresh elements (pool empty). Run #1's cleanup
    // paused element #1, rejecting its pending play() with AbortError.
    expect(FakeAudio.instances.length).toBe(2);
    const second = FakeAudio.instances[1];
    expect(second.playCalls).toBe(1);

    // THE regression: the late AbortError must not mark the live activation
    // done. Before the fix this was done=true with zero playing events.
    expect(state!.done).toBe(false);
    expect(state!.playing).toBe(false);

    await act(async () => {
      second.resolvePlay();
    });
    expect(state!.playing).toBe(true);
    expect(state!.done).toBe(false);

    await act(async () => {
      second.onended?.();
    });
    expect(state!.done).toBe(true);
    expect(state!.progress).toBe(1);
    expect(state!.playing).toBe(false);
  });

  it('strict-mode double effect over the SHARED pooled element (the production shape)', async () => {
    preloadOpenerClips(['/voice/pooled.mp3']);
    const pooledEl = FakeAudio.instances[0];
    pooledEl.dispatch('canplaythrough'); // warm → the ready gate is skipped

    await render(
      <StrictMode>
        <Probe src="/voice/pooled.mp3" active />
      </StrictMode>,
    );
    await act(async () => {});

    // No fresh element: run #1 claimed, its cleanup released, run #2 re-claimed
    // the SAME warm element. Cleanup #1's pause aborted play #1; the live
    // activation re-played the element.
    expect(FakeAudio.instances.length).toBe(1);
    expect(pooledEl.playCalls).toBe(2);
    expect(state!.done).toBe(false);

    await act(async () => {
      pooledEl.resolvePlay();
    });
    expect(state!.playing).toBe(true);

    await act(async () => {
      pooledEl.onended?.();
    });
    expect(state!.done).toBe(true);
  });

  it('re-arms play() when an external pause aborts the live activation', async () => {
    await render(<Probe src="/voice/x.mp3" active />);
    const el = FakeAudio.instances[0];
    expect(el.playCalls).toBe(1);

    // Something else pauses the element under our pending play().
    await act(async () => {
      el.pause();
    });

    // Live activation: AbortError is re-armable, not terminal.
    expect(el.playCalls).toBe(2);
    expect(state!.done).toBe(false);

    await act(async () => {
      el.resolvePlay();
    });
    expect(state!.playing).toBe(true);
    expect(state!.done).toBe(false);
  });

  it('NotAllowedError holds the beat un-settled and plays on the next gesture (B4 defer contract)', async () => {
    FakeAudio.playBehaviors = [new DOMException('no gesture', 'NotAllowedError')];
    await render(<Probe src="/voice/x.mp3" active />);
    const el = FakeAudio.instances[0];

    // Held: not done (the beat must not silently advance), not playing.
    expect(state!.done).toBe(false);
    expect(state!.playing).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    await act(async () => {
      el.resolvePlay();
    });
    expect(state!.playing).toBe(true);
    expect(state!.done).toBe(false);
  });

  it('terminal failure settles by failure with one quiet warn (flow never dead-ends)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    FakeAudio.playBehaviors = [new DOMException('bad media', 'NotSupportedError')];
    await render(<Probe src="/voice/x.mp3" active />);

    expect(state!.done).toBe(true);
    expect(state!.progress).toBe(1);
    expect(state!.playing).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('deactivation stops and rewinds the audio (cleanup contract)', async () => {
    await render(<Probe src="/voice/x.mp3" active />);
    const el = FakeAudio.instances[0];
    await act(async () => {
      el.resolvePlay();
    });
    el.currentTime = 4;
    expect(state!.playing).toBe(true);

    await render(<Probe src="/voice/x.mp3" active={false} />);
    expect(el.paused).toBe(true);
    expect(el.currentTime).toBe(0);
    expect(state!.done).toBe(true);
  });
});
