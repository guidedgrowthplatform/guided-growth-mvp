/** @vitest-environment jsdom */

/**
 * B28: entering the deferred wait must be observable (onDeferred) so callers
 * can surface the tap-to-play affordance; the deferred play still fires on the
 * next gesture exactly as before.
 */
import { describe, expect, it, vi } from 'vitest';
import { attemptPlayWithGestureFallback } from './attempt-play-with-gesture-fallback';

function audioStub(behaviors: Array<'resolve' | DOMException>) {
  return {
    play: vi.fn(() => {
      const b = behaviors.shift() ?? 'resolve';
      return b === 'resolve' ? Promise.resolve() : Promise.reject(b);
    }),
  } as unknown as HTMLAudioElement;
}

const notAllowed = () => new DOMException('no gesture', 'NotAllowedError');

describe('attemptPlayWithGestureFallback onDeferred', () => {
  it('fires once when autoplay is rejected and defer is on, then plays on the gesture', async () => {
    const el = audioStub([notAllowed(), 'resolve']);
    const onDeferred = vi.fn();
    const p = attemptPlayWithGestureFallback(el, { defer: true, onDeferred });
    await Promise.resolve();
    expect(onDeferred).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('pointerdown'));
    await expect(p).resolves.toBeUndefined();
    expect(el.play).toHaveBeenCalledTimes(2);
  });

  it('does not fire when play succeeds immediately', async () => {
    const el = audioStub(['resolve']);
    const onDeferred = vi.fn();
    await attemptPlayWithGestureFallback(el, { defer: true, onDeferred });
    expect(onDeferred).not.toHaveBeenCalled();
  });

  it('does not fire for non-autoplay failures (they throw through)', async () => {
    const el = audioStub([new DOMException('boom', 'NotSupportedError')]);
    const onDeferred = vi.fn();
    await expect(attemptPlayWithGestureFallback(el, { defer: true, onDeferred })).rejects.toThrow();
    expect(onDeferred).not.toHaveBeenCalled();
  });
});
