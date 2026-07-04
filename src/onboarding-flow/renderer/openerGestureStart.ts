/**
 * openerGestureStart, starts an opener clip synchronously inside a user
 * gesture (the Get-started tap) so the browser's autoplay policy can never
 * block the FIRST audio of onboarding.
 *
 * Why: the first clip used to be started by the beat that owns it, one render
 * after the tap. When the browser rejected that play() (NotAllowedError), the
 * deferred-to-tap fallback started it on the NEXT gesture, which testers
 * experienced as audio firing on a random unrelated tap. Calling play() in the
 * same gesture frame as the tap makes the start deterministic AND counts as
 * the user-interaction unlock for every later beat's audio.
 *
 * The element comes from the same openerPreloadPool the flow beats use, so
 * the tap plays the warm buffered element (B15) when preloading ran. There is
 * deliberately NO readiness await before play(): awaiting would leave the
 * gesture frame and forfeit the activation. The browser begins playback as
 * soon as it has data; gesture attribution is captured at call time.
 *
 * The owning beat (SplashIntro via IntroGate) must ADOPT the returned handle
 * instead of re-arming its own play(), see the adoptedOpener prop.
 */

import { isQaMuted } from '@/onboarding-flow/qaSound';
import { claimPreloadedClip, preloadOpenerClips } from './openerPreloadPool';

export interface GestureStartedOpener {
  /** The audio element play() was called on inside the gesture. */
  el: HTMLAudioElement;
  /** Clip src, so an adopter can sanity-check it got the clip it expects. */
  src: string;
  /**
   * Resolves true when the gesture play() actually started playback, false
   * when the browser rejected it (the adopter then falls back to its own
   * play attempt, keeping the deferred-to-tap safety net).
   */
  started: Promise<boolean>;
  /** Pause + rewind and return a pooled element to the pool. Idempotent. */
  release(): void;
}

/**
 * MUST be called synchronously from a user-gesture handler (click/pointerup).
 * Claims the preloaded element when available (fresh Audio as fallback) and
 * calls play() in the same frame.
 */
/**
 * Bless a set of clips inside a user gesture WITHOUT audibly playing them:
 * play() then pause() each POOLED element in the gesture frame, so the same
 * element a beat later claims replays programmatically (the per-element
 * autoplay unlock, B28). Entries are created via the preload pool, so this
 * doubles as the B15 warm-up. Best-effort: rejections leave the deferred-to-
 * tap fallback (+ affordance) as the safety net. MUST be called synchronously
 * from a gesture handler.
 */
export function blessOpenerClipsInGesture(srcs: readonly string[]): void {
  preloadOpenerClips(srcs);
  for (const src of srcs) {
    const pooled = claimPreloadedClip(src);
    if (!pooled) continue;
    const el = pooled.el;
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          /* rejection = stays unblessed; the deferred fallback covers the beat */
        });
      }
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore: bless is best-effort */
    }
    pooled.release();
  }
}

export function startOpenerFromGesture(src: string): GestureStartedOpener {
  const pooled = claimPreloadedClip(src);
  const el = pooled?.el ?? new Audio(src);
  if (!pooled) el.preload = 'auto';
  try {
    el.currentTime = 0;
  } catch {
    /* not yet seekable, starts at 0 anyway */
  }
  el.muted = isQaMuted();

  const p = el.play();
  const started = (p && typeof p.then === 'function' ? p : Promise.resolve())
    .then(() => true)
    .catch((err: unknown) => {
      const name =
        typeof (err as { name?: unknown } | null | undefined)?.name === 'string'
          ? (err as { name: string }).name
          : err;
      console.warn('[gesture-opener] play() inside the gesture rejected', src, name);
      return false;
    });

  let released = false;
  return {
    el,
    src,
    started,
    release() {
      if (released) return;
      released = true;
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      pooled?.release();
    },
  };
}
