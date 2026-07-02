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
    pool.set(src, { el, ready: false, failed: false, readyPromise });
    queue.push(src);
  }
  pump();
}

/**
 * The preloaded entry for a clip, or null when preloading never ran or failed
 * (caller falls back to a fresh element — the lazy path).
 */
export function getPreloadedClip(src: string): PreloadEntry | null {
  const entry = pool.get(src);
  if (!entry || entry.failed) return null;
  return entry;
}

/** Test-only: clear pool state. */
export function resetOpenerPreloadPool(): void {
  pool.clear();
  queue = [];
  activeWorkers = 0;
}
