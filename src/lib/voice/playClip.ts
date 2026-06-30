import type { SpeakOpenerHandle } from './speakOpener';

/**
 * Play one PRE-RECORDED opener clip (the check-in MP3 ritual lines) and return a
 * SpeakOpenerHandle, the exact shape speakOpener returns, so the voice layer can
 * swap recorded playback in for Cartesia TTS with no other change.
 *
 * `done` resolves when the clip ends OR fails (a failed clip must never strand the
 * mic closed, so the caller treats "done" as "opener no longer pending", same as
 * speakOpener). `onProgress(fraction)` reports 0..1 off the audio element's own
 * clock so the opener karaokes in sync with the recording. Always ends with 1.
 */
export function playClip(url: string, onProgress?: (fraction: number) => void): SpeakOpenerHandle {
  if (!url) return { done: Promise.resolve(), stop: () => {} };

  const el = new Audio(url);
  el.preload = 'auto';
  let settled = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    onProgress?.(1);
    resolveDone();
  };

  if (onProgress) {
    el.ontimeupdate = () => {
      if (settled) return;
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) onProgress(Math.min(1, el.currentTime / d));
    };
  }
  el.onended = finish;
  el.onerror = finish;
  void el.play().catch(finish);

  return {
    done,
    stop: () => {
      settled = true;
      try {
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {
        /* ignore */
      }
      resolveDone();
    },
  };
}
