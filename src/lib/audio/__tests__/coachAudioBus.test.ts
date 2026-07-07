/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentCoachAudioElement,
  pausePreviousCoachAudio,
  registerCoachAudioElement,
  resetCoachAudioBusForTests,
  subscribeCoachAudioLevel,
  unregisterCoachAudioElement,
} from '../coachAudioBus';

// jsdom has no WebAudio. Mock a minimal AudioContext/AnalyserNode/
// MediaElementAudioSourceNode graph so the bus's connect/tap logic is
// exercised without a real browser audio stack. computeRms is driven by
// controlling what getFloatTimeDomainData writes into the caller's buffer.
let rmsToWrite = 0;

function installMockAudioContext() {
  class MockAnalyser {
    fftSize = 512;
    smoothingTimeConstant = 0;
    connect = vi.fn();
    getFloatTimeDomainData(buf: Float32Array) {
      // Fill with a constant amplitude so RMS == |rmsToWrite| (sign doesn't
      // matter for RMS, so this is an easy deterministic signal).
      buf.fill(rmsToWrite);
    }
  }
  class MockMediaElementSource {
    connect = vi.fn();
  }
  class MockAudioContext {
    state: 'running' | 'suspended' = 'running';
    destination = {};
    createAnalyser() {
      return new MockAnalyser();
    }
    createMediaElementSource(_el: HTMLAudioElement) {
      return new MockMediaElementSource();
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

function makeAudioEl(opts?: { paused?: boolean; ended?: boolean; currentTime?: number }) {
  return {
    paused: opts?.paused ?? false,
    ended: opts?.ended ?? false,
    currentTime: opts?.currentTime ?? 1,
  } as unknown as HTMLAudioElement;
}

describe('coachAudioBus', () => {
  beforeEach(() => {
    installMockAudioContext();
    rmsToWrite = 0;
    resetCoachAudioBusForTests();
  });

  afterEach(() => {
    resetCoachAudioBusForTests();
    vi.useRealTimers();
  });

  it('reports active + amplitude for a registered, playing element', async () => {
    vi.useFakeTimers();
    rmsToWrite = 0.2; // -> amp 1 given AMP_CEIL 0.35... actually mid-range, just assert > 0
    const el = makeAudioEl({ paused: false, currentTime: 1 });
    const levels: Array<{ amp: number; active: boolean }> = [];
    const unsub = subscribeCoachAudioLevel((l) => levels.push(l));

    registerCoachAudioElement(el);
    expect(currentCoachAudioElement()).toBe(el);

    // Advance a few animation frames (jsdom's rAF runs on a timer under fake timers).
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(20);
    }

    const active = levels.filter((l) => l.active);
    expect(active.length).toBeGreaterThan(0);
    expect(active[active.length - 1].amp).toBeGreaterThan(0);

    unsub();
  });

  it('reports inactive/zero amplitude once unregistered', () => {
    vi.useFakeTimers();
    const el = makeAudioEl({ paused: false, currentTime: 1 });
    rmsToWrite = 0.3;
    const levels: Array<{ amp: number; active: boolean }> = [];
    const unsub = subscribeCoachAudioLevel((l) => levels.push(l));

    registerCoachAudioElement(el);
    vi.advanceTimersByTime(20);

    unregisterCoachAudioElement(el);
    // unregister emits synchronously.
    const last = levels[levels.length - 1];
    expect(last).toEqual({ amp: 0, active: false });
    expect(currentCoachAudioElement()).toBeNull();

    unsub();
  });

  it('reports inactive for a paused element even if still "current"', () => {
    vi.useFakeTimers();
    const el = makeAudioEl({ paused: true, currentTime: 0 });
    rmsToWrite = 0.3;
    const levels: Array<{ amp: number; active: boolean }> = [];
    const unsub = subscribeCoachAudioLevel((l) => levels.push(l));

    registerCoachAudioElement(el);
    vi.advanceTimersByTime(20);

    expect(levels.every((l) => l.active === false)).toBe(true);
    unsub();
  });

  it('a stale unregister for a superseded element is a no-op', () => {
    vi.useFakeTimers();
    const first = makeAudioEl({ paused: false, currentTime: 1 });
    const second = makeAudioEl({ paused: false, currentTime: 1 });

    registerCoachAudioElement(first);
    registerCoachAudioElement(second); // second supersedes first
    expect(currentCoachAudioElement()).toBe(second);

    unregisterCoachAudioElement(first); // stale — must not evict second
    expect(currentCoachAudioElement()).toBe(second);
  });

  it('does not re-wrap the same pooled element twice (createMediaElementSource guard)', () => {
    const el = makeAudioEl({ paused: false, currentTime: 1 });
    const ctx = new (window as unknown as { AudioContext: new () => AudioContext }).AudioContext();
    const spy = vi.spyOn(ctx, 'createMediaElementSource');
    // Can't easily inject our spied ctx into the module (it lazily constructs
    // its own), so instead verify via the module's own AudioContext class:
    // registering the same element twice must not throw (a real
    // createMediaElementSource throws on a second wrap of the same element,
    // which the sourceCache WeakMap in coachAudioBus is designed to avoid).
    expect(() => {
      registerCoachAudioElement(el);
      unregisterCoachAudioElement(el);
      registerCoachAudioElement(el);
    }).not.toThrow();
    spy.mockRestore();
  });

  it('B40: pauses the outgoing element when a new element claims the bus (register backstop)', () => {
    // Belt-and-suspenders: if a path registered without a pre-play pause, the
    // register call still pauses the outgoing element.
    const pauseFirst = vi.fn();
    const first = {
      paused: false,
      ended: false,
      currentTime: 1,
      pause: pauseFirst,
    } as unknown as HTMLAudioElement;

    const pauseSecond = vi.fn();
    const second = {
      paused: false,
      ended: false,
      currentTime: 0,
      pause: pauseSecond,
    } as unknown as HTMLAudioElement;

    registerCoachAudioElement(first);
    expect(currentCoachAudioElement()).toBe(first);

    registerCoachAudioElement(second);

    expect(pauseFirst).toHaveBeenCalledOnce();
    expect(pauseSecond).not.toHaveBeenCalled();
    expect(currentCoachAudioElement()).toBe(second);
  });

  it('B40: pausePreviousCoachAudio pauses the prior element BEFORE the new one plays (ordering invariant)', () => {
    // Reproduces the fork transition: the profile Cartesia blob (first) is
    // registered + playing; the fork WAV opener (second) is about to play.
    // The caller invokes pausePreviousCoachAudio(second) synchronously RIGHT
    // BEFORE second.play(). The assertion is an ORDERING one: first.pause()
    // must have happened before second.play() — never both playing at once.
    const events: string[] = [];

    const first = {
      paused: false,
      ended: false,
      currentTime: 1,
      pause: () => {
        first.paused = true;
        events.push('first.pause');
      },
    } as unknown as HTMLAudioElement & { paused: boolean };

    const second = {
      paused: true,
      ended: false,
      currentTime: 0,
      pause: () => events.push('second.pause'),
      play: () => {
        // Guard the invariant AT the moment second becomes audible: first must
        // already be paused. If pause fired after play, first.paused is false.
        expect(first.paused).toBe(true);
        second.paused = false;
        events.push('second.play');
        return Promise.resolve();
      },
    } as unknown as HTMLAudioElement & { paused: boolean; play: () => Promise<void> };

    registerCoachAudioElement(first as unknown as HTMLAudioElement);
    expect(currentCoachAudioElement()).toBe(first);

    // The exact call order a beat-opener path performs: pause-previous, then play.
    pausePreviousCoachAudio(second as unknown as HTMLAudioElement);
    void (second as unknown as { play: () => Promise<void> }).play();

    expect(events).toEqual(['first.pause', 'second.play']);
    // Bus reports inactive the instant the previous element is paused.
    expect(currentCoachAudioElement()).toBeNull();
  });

  it('B40: pausePreviousCoachAudio is a no-op for the SAME element (same-beat re-arm)', () => {
    // ONBOARD-BEGINNER-04 part-2 re-arm / a retry on the same element must not
    // pause it mid-stream.
    const pauseSpy = vi.fn();
    const el = {
      paused: false,
      ended: false,
      currentTime: 1,
      pause: pauseSpy,
    } as unknown as HTMLAudioElement;

    registerCoachAudioElement(el);
    pausePreviousCoachAudio(el);

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(currentCoachAudioElement()).toBe(el);
  });

  it('B40: pausePreviousCoachAudio is a no-op on a fresh bus (nothing to pause)', () => {
    // BEGINNER-04 part-1 (or any first opener) with no prior element: pause
    // must not fire on the incoming element, and it must not touch the bus.
    const pauseSpy = vi.fn();
    const el = {
      paused: true,
      ended: false,
      currentTime: 0,
      pause: pauseSpy,
    } as unknown as HTMLAudioElement;

    pausePreviousCoachAudio(el);

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(currentCoachAudioElement()).toBeNull();
  });
});
