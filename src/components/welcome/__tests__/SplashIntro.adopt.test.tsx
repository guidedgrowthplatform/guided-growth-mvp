/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Adopt-not-double-start: when IntroGate's Get-started tap already started the
 * intro clip inside its own gesture frame (startOpenerFromGesture), SplashIntro
 * must ADOPT that element, track the playback that is underway, and never
 * arm a second play() over it. If the gesture play() was rejected, it falls
 * back to its own attempt (which keeps the deferred-to-tap safety net).
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GestureStartedOpener } from '@/onboarding-flow/renderer/openerGestureStart';
import { SplashIntro } from '../SplashIntro';

class FakeEl {
  muted = false;
  currentTime = 0;
  paused = false;
  ended = false;
  readyState = 4;
  error: MediaError | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playCalls = 0;
  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

function makeHandle(el: FakeEl, startedOk: boolean, src = '/voice/splash_welcome.mp3') {
  const released = { count: 0 };
  const handle: GestureStartedOpener = {
    el: el as unknown as HTMLAudioElement,
    src,
    started: Promise.resolve(startedOk),
    release: () => {
      released.count += 1;
    },
  };
  return { handle, released };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('fetch', () => Promise.reject(new Error('no network in test')));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SplashIntro adoptedOpener', () => {
  it('adopts the gesture-started element and never calls play() on it (no double start)', async () => {
    const el = new FakeEl(); // playing since the tap: paused=false, playCalls untouched
    const { handle } = makeHandle(el, true);
    const onComplete = vi.fn();

    await act(async () => {
      root.render(
        <SplashIntro
          autoPlay
          skipSplash
          audioSrc="/voice/splash_welcome.mp3"
          adoptedOpener={handle}
          onComplete={onComplete}
        />,
      );
    });

    // THE contract: playback was started by the gesture, not re-armed here.
    expect(el.playCalls).toBe(0);
    // Adoption wired the finish path onto the adopted element.
    expect(el.onended).toBeTypeOf('function');
    expect(onComplete).not.toHaveBeenCalled();

    // done-after-playing preserved: the clip ending drives onComplete.
    await act(async () => {
      el.ended = true;
      el.onended?.();
    });
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('falls back to its own play() when the gesture start was rejected', async () => {
    const el = new FakeEl();
    el.paused = true; // the gesture play() never started it
    const { handle } = makeHandle(el, false);

    await act(async () => {
      root.render(
        <SplashIntro
          autoPlay
          skipSplash
          audioSrc="/voice/splash_welcome.mp3"
          adoptedOpener={handle}
          onComplete={() => {}}
        />,
      );
    });

    // The safety net: SplashIntro re-armed playback itself, exactly once.
    expect(el.playCalls).toBe(1);
  });

  it('re-arms play() when the adopted element was paused before adoption (strict-mode remount shape)', async () => {
    const el = new FakeEl();
    el.paused = true; // e.g. a dev strict-mode cleanup paused it post-gesture
    const { handle } = makeHandle(el, true); // the gesture play() itself succeeded

    await act(async () => {
      root.render(
        <SplashIntro
          autoPlay
          skipSplash
          audioSrc="/voice/splash_welcome.mp3"
          adoptedOpener={handle}
          onComplete={() => {}}
        />,
      );
    });

    expect(el.playCalls).toBe(1);
    expect(el.paused).toBe(false);
  });

  it('ignores a handle whose src does not match audioSrc', async () => {
    const el = new FakeEl();
    const { handle } = makeHandle(el, true, '/voice/some_other_clip.mp3');
    // The internal <audio> path would call HTMLMediaElement.play (unimplemented
    // in jsdom), stub it so the fallback path is observable without noise.
    const htmlPlay = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());

    await act(async () => {
      root.render(
        <SplashIntro
          autoPlay
          skipSplash
          audioSrc="/voice/splash_welcome.mp3"
          adoptedOpener={handle}
          onComplete={() => {}}
        />,
      );
    });

    // Mismatched handle untouched; the internal element carried the playback.
    expect(el.playCalls).toBe(0);
    expect(htmlPlay).toHaveBeenCalledTimes(1);
  });
});
