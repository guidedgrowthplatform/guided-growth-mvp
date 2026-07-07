/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerCoachAudioElement,
  resetCoachAudioBusForTests,
  unregisterCoachAudioElement,
} from '@/lib/audio/coachAudioBus';
import { useCoachVoiceActivity, type CoachVoiceActivity } from '../useCoachVoiceActivity';

// Mock AudioContext so coachAudioBus can register/tap a fake element without
// a real browser audio stack (same approach as coachAudioBus.test.ts).
let rmsToWrite = 0;
function installMockAudioContext() {
  class MockAnalyser {
    fftSize = 512;
    smoothingTimeConstant = 0;
    connect = vi.fn();
    getFloatTimeDomainData(buf: Float32Array) {
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
    createMediaElementSource() {
      return new MockMediaElementSource();
    }
    resume() {
      return Promise.resolve();
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

function makeAudioEl(opts?: { paused?: boolean; currentTime?: number }) {
  return {
    paused: opts?.paused ?? false,
    ended: false,
    currentTime: opts?.currentTime ?? 1,
  } as unknown as HTMLAudioElement;
}

let latest: CoachVoiceActivity | null = null;
function Bridge({
  assistantSpeaking,
  vapiVolumeLevel = 0,
  onValue,
}: {
  assistantSpeaking: boolean;
  vapiVolumeLevel?: number;
  onValue: (v: CoachVoiceActivity) => void;
}) {
  const value = useCoachVoiceActivity(assistantSpeaking, vapiVolumeLevel);
  onValue(value);
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(props: { assistantSpeaking: boolean; vapiVolumeLevel?: number }) {
  act(() => {
    root.render(<Bridge {...props} onValue={(v) => (latest = v)} />);
  });
}

beforeEach(() => {
  installMockAudioContext();
  rmsToWrite = 0;
  resetCoachAudioBusForTests();
  latest = null;
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // ignore
  }
  container.remove();
  resetCoachAudioBusForTests();
  vi.useRealTimers();
});

describe('useCoachVoiceActivity', () => {
  it('silent when not speaking and no audio registered', () => {
    mount({ assistantSpeaking: false });
    expect(latest).toEqual({ intensity: 0, speaking: false, source: 'silent' });
  });

  it('priority 3: synthesizes a fallback envelope while speaking with no real signal yet', () => {
    mount({ assistantSpeaking: true });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(latest?.speaking).toBe(true);
    expect(latest?.source).toBe('fallback');
    expect(latest?.intensity).toBeGreaterThan(0);
  });

  it('priority 2: a real Vapi volume-level reading wins over the fallback', () => {
    mount({ assistantSpeaking: true, vapiVolumeLevel: 0.6 });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(latest?.source).toBe('vapi');
    expect(latest?.speaking).toBe(true);
    expect(latest?.intensity).toBeGreaterThan(0);
  });

  it('priority 1: real playback via coachAudioBus wins over a concurrent Vapi level', () => {
    mount({ assistantSpeaking: true, vapiVolumeLevel: 0.6 });
    const el = makeAudioEl({ paused: false, currentTime: 1 });
    rmsToWrite = 0.3;
    act(() => {
      registerCoachAudioElement(el);
      vi.advanceTimersByTime(20);
    });
    expect(latest?.source).toBe('audio');
    expect(latest?.speaking).toBe(true);
    expect(latest?.intensity).toBeGreaterThan(0);

    act(() => {
      unregisterCoachAudioElement(el);
    });
  });

  it('drops to silent when assistantSpeaking flips false and no audio is registered', () => {
    mount({ assistantSpeaking: true });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(latest?.speaking).toBe(true);

    mount({ assistantSpeaking: false });
    expect(latest).toEqual({ intensity: 0, speaking: false, source: 'silent' });
  });

  // Bug fix: the exact reported MP3-orb-dead scenario. An MP3 opener plays
  // while Vapi is never speaking (assistantSpeaking stays false the whole
  // time — no hybrid Vapi resume, no vapi volume level). Before the fix,
  // priority 1's subscriber only handled the "bus became active" tick; the
  // "bus went inactive" tick (the clip ending) was a silent no-op, so once a
  // clip had played once, `speaking`/`intensity` stuck at their last live
  // values forever instead of settling back to silent. That stale "stuck
  // speaking" state is the mirror image of "dead": either way the ring never
  // reflects real coach-audio state going forward.
  it('reports real coachAudioBus playback with assistantSpeaking false throughout (MP3-only opener), and resets to silent when the clip ends', () => {
    mount({ assistantSpeaking: false });
    expect(latest).toEqual({ intensity: 0, speaking: false, source: 'silent' });

    const el = makeAudioEl({ paused: false, currentTime: 1 });
    rmsToWrite = 0.3;
    act(() => {
      registerCoachAudioElement(el);
      vi.advanceTimersByTime(20);
    });
    expect(latest?.source).toBe('audio');
    expect(latest?.speaking).toBe(true);
    expect(latest?.intensity).toBeGreaterThan(0);

    // Clip ends: bus reports inactive. Nothing else (no vapi level, no
    // assistantSpeaking fallback window) should keep the stale reading alive.
    act(() => {
      unregisterCoachAudioElement(el);
      vi.advanceTimersByTime(20);
    });
    expect(latest).toEqual({ intensity: 0, speaking: false, source: 'silent' });
  });
});
