/**
 * openerPreloadPool — warms the beat-opener MP3 clips at flow mount so playback
 * start doesn't ride the network when a beat activates (B15).
 *
 * Pool of bare HTMLAudioElements keyed by clip src (the same elements
 * useBeatOpenerMp3 then plays — reusing the element keeps the buffered data,
 * and keeps `duration` finite, unlike a blob objectURL which Chrome reports as
 * Infinity). A clip is "ready" once canplaythrough fires; first play gates on
 * that (bounded — see useBeatOpenerMp3) so the first word is never clipped by
 * a cold buffer (B14).
 *
 * Preloads run 3-at-a-time so a slow network fills the earliest beats first
 * instead of 18 range-requests fighting each other.
 */

interface PreloadEntry {
  el: HTMLAudioElement;
  ready: boolean;
  failed: boolean;
  readyPromise: Promise<void>;
  /** True while a consumer holds the element for playback (see claim below). */
  claimed: boolean;
}

/** A claimed pooled clip: exclusive playback handle over the warm element. */
export interface ClaimedClip {
  el: HTMLAudioElement;
  /** Live view of the entry's canplaythrough state. */
  readonly ready: boolean;
  readyPromise: Promise<void>;
  /** Return the element to the pool. Idempotent per claim. */
  release(): void;
}

const pool = new Map<string, PreloadEntry>();

const CONCURRENCY = 3;
let queue: string[] = [];
let activeWorkers = 0;

function startEntry(src: string): void {
  const entry = pool.get(src);
  if (!entry) return;
  const { el } = entry;
  el.preload = 'auto';
  el.load();
}

function pump(): void {
  while (activeWorkers < CONCURRENCY && queue.length > 0) {
    const src = queue.shift()!;
    const entry = pool.get(src);
    if (!entry || entry.ready || entry.failed) continue;
    activeWorkers++;
    startEntry(src);
    void entry.readyPromise.finally(() => {
      activeWorkers--;
      pump();
    });
  }
}

/** Queue the given clip srcs for preloading (idempotent per src). */
export function preloadOpenerClips(srcs: readonly string[]): void {
  if (typeof Audio === 'undefined') return;
  for (const src of srcs) {
    if (!src || pool.has(src)) continue;
    const el = new Audio();
    el.src = src;
    const readyPromise = new Promise<void>((resolve) => {
      const settle = (ok: boolean) => {
        const e = pool.get(src);
        if (e) {
          e.ready = ok;
          e.failed = !ok;
        }
        el.removeEventListener('canplaythrough', onReady);
        el.removeEventListener('error', onError);
        resolve();
      };
      const onReady = () => settle(true);
      const onError = () => settle(false);
      el.addEventListener('canplaythrough', onReady);
      el.addEventListener('error', onError);
    });
    pool.set(src, { el, ready: false, failed: false, readyPromise, claimed: false });
    queue.push(src);
  }
  pump();
}

/**
 * Claim the preloaded clip for exclusive playback. Returns null when
 * preloading never ran or failed, or when ANOTHER consumer currently holds
 * the element — the caller then falls back to a fresh Audio element (the lazy
 * path: no warm buffer, but the browser HTTP cache usually covers it, and two
 * consumers can never pause each other's pending play() on a shared element).
 * Serializing the handout is half of the B4 fix; the activation tokens in
 * useBeatOpenerMp3 are the other half.
 */
export function claimPreloadedClip(src: string): ClaimedClip | null {
  const entry = pool.get(src);
  if (!entry || entry.failed || entry.claimed) return null;
  entry.claimed = true;
  let released = false;
  return {
    el: entry.el,
    get ready() {
      return entry.ready;
    },
    readyPromise: entry.readyPromise,
    release() {
      if (released) return;
      released = true;
      entry.claimed = false;
    },
  };
}

/** Test-only: clear pool state. */
export function resetOpenerPreloadPool(): void {
  pool.clear();
  queue = [];
  activeWorkers = 0;
}
