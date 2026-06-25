/**
 * Once-per-teardown latch for useRealtimeVoice's onEnd.
 *
 * Regression context: a local stop() fired onEnd twice, once via
 * dropToken() -> releaseToken() -> token.onCleanup (synchronous), and once via
 * stop()'s own direct call. The second fire read as a REMOTE end in the provider
 * (didCallStopRef already consumed), arming a ~3s remote-end cooldown that
 * blocked toggling voice off then immediately on. The latch collapses both calls
 * within one teardown into a single onEnd, and re-arms for the next call.
 */
import { describe, expect, it, vi } from 'vitest';
import { createOnEndLatch } from '../useRealtimeVoice';

describe('createOnEndLatch', () => {
  it('fires onEnd exactly once per teardown even when called twice', () => {
    const onEnd = vi.fn();
    const latch = createOnEndLatch(onEnd);

    // Simulate a local stop(): onCleanup fires, then stop()'s direct call.
    latch.fire();
    latch.fire();

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('re-arms on the next start so a fresh teardown fires again', () => {
    const onEnd = vi.fn();
    const latch = createOnEndLatch(onEnd);

    // First call teardown (double-fire collapses to one).
    latch.fire();
    latch.fire();
    expect(onEnd).toHaveBeenCalledTimes(1);

    // A fresh start re-arms the latch.
    latch.arm();

    // Second call teardown fires again (still collapsed to one for that teardown).
    latch.fire();
    latch.fire();
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('arming an unfired latch does not suppress the first fire', () => {
    const onEnd = vi.fn();
    const latch = createOnEndLatch(onEnd);
    latch.arm(); // arm before any fire, mirroring start() re-arming before the call ends
    latch.fire();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
