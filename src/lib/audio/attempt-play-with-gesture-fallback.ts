// Capture-phase so a parent stopPropagation can't starve us of the gesture.
const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;

/**
 * play() the audio; on NotAllowedError with `defer`, retry after the next
 * user gesture. Resolves on actual playback start. `onDeferred` fires when
 * entering the wait-for-gesture state (B28: callers surface an affordance).
 */
export async function attemptPlayWithGestureFallback(
  audio: HTMLAudioElement,
  opts?: { defer?: boolean; signal?: AbortSignal; onDeferred?: () => void },
): Promise<void> {
  try {
    await audio.play();
    return;
  } catch (err) {
    if (!opts?.defer) throw err;
    if (!(err instanceof DOMException) || err.name !== 'NotAllowedError') {
      throw err;
    }
  }

  opts?.onDeferred?.();

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      for (const evt of GESTURE_EVENTS) {
        window.removeEventListener(evt, handler, true);
      }
      opts?.signal?.removeEventListener('abort', onAbort);
    };
    const handler = () => {
      cleanup();
      audio.play().then(resolve).catch(reject);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Playback attempt aborted', 'AbortError'));
    };

    if (opts?.signal?.aborted) {
      reject(new DOMException('Playback attempt aborted', 'AbortError'));
      return;
    }

    for (const evt of GESTURE_EVENTS) {
      window.addEventListener(evt, handler, { once: true, capture: true });
    }
    opts?.signal?.addEventListener('abort', onAbort, { once: true });
  });
}
