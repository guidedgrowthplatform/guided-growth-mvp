/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { attemptPlayWithGestureFallback } from '../attempt-play-with-gesture-fallback';

function makeMockAudio(playBehavior: () => Promise<void>): HTMLAudioElement {
  const audio = { play: vi.fn(playBehavior) } as unknown as HTMLAudioElement;
  return audio;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('attemptPlayWithGestureFallback', () => {
  it('resolves immediately when play() succeeds', async () => {
    const audio = makeMockAudio(() => Promise.resolve());
    await expect(attemptPlayWithGestureFallback(audio)).resolves.toBeUndefined();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('rejects when play() fails with non-autoplay error', async () => {
    const audio = makeMockAudio(() => Promise.reject(new Error('decoder error')));
    await expect(attemptPlayWithGestureFallback(audio)).rejects.toThrow('decoder error');
  });

  it('rejects on autoplay block when defer is not set', async () => {
    const err = new DOMException('autoplay blocked', 'NotAllowedError');
    const audio = makeMockAudio(() => Promise.reject(err));
    await expect(attemptPlayWithGestureFallback(audio)).rejects.toBe(err);
  });

  it('defers to first gesture and retries on NotAllowedError', async () => {
    const err = new DOMException('autoplay blocked', 'NotAllowedError');
    let callCount = 0;
    const audio = makeMockAudio(() => {
      callCount++;
      return callCount === 1 ? Promise.reject(err) : Promise.resolve();
    });

    let resolved = false;
    void attemptPlayWithGestureFallback(audio, { defer: true }).then(() => {
      resolved = true;
    });
    await flush();
    expect(resolved).toBe(false);
    expect(callCount).toBe(1);

    // Fire a gesture; helper should retry play()
    window.dispatchEvent(new Event('pointerdown'));
    await flush();
    await flush();
    expect(callCount).toBe(2);
    expect(resolved).toBe(true);
  });

  it('aborts via AbortSignal before a gesture arrives', async () => {
    const err = new DOMException('autoplay blocked', 'NotAllowedError');
    const audio = makeMockAudio(() => Promise.reject(err));
    const controller = new AbortController();

    const promise = attemptPlayWithGestureFallback(audio, {
      defer: true,
      signal: controller.signal,
    });
    await flush();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
