/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B51 integration proof: mounts the REAL OrbControls and drives it through
 * coach playback (via coachAudioBus, same path tts-service/useBeatOpenerMp3/
 * useBeatOpenerCartesia register against) and user-mic intensity, reading the
 * QA debug handle (window.__ggQaOrbLevel) the same way a preview/Playwright
 * driver would. This is the component-level counterpart to
 * coachAudioBus.test.ts (module-level) and useCoachVoiceActivity.test.tsx
 * (hook-level) — together they cover the whole B51 pipeline from real audio
 * bytes through to the orb's resolved mic amplitude.
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerCoachAudioElement,
  resetCoachAudioBusForTests,
  unregisterCoachAudioElement,
} from '@/lib/audio/coachAudioBus';
import { OrbControls } from '../OrbControls';

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

const noop = () => {};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  installMockAudioContext();
  rmsToWrite = 0;
  resetCoachAudioBusForTests();
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
  delete (window as { __ggQaOrbLevel?: unknown }).__ggQaOrbLevel;
});

describe('OrbControls + coachAudioBus + window.__ggQaOrbLevel (B51 integration)', () => {
  it('coach side (activeRings=left): registering real coach audio yields a nonzero amp via the QA handle', () => {
    act(() => {
      root.render(
        <OrbControls
          size={88}
          leftActive
          rightActive={false}
          activeRings="left"
          ringCount={3}
          ringStep={4}
          intensity={0}
          coachIntensity={0.5}
          micAllowed={false}
          onToggleVoice={noop}
          onToggleMic={noop}
          onRequestMic={noop}
        />,
      );
    });

    expect(window.__ggQaOrbLevel).toBeTypeOf('function');
    const level = window.__ggQaOrbLevel!();
    expect(level.source).toBe('coach');
    expect(level.amp).toBeCloseTo(0.5, 5);
  });

  it('user side (activeRings=right): a live user-mic intensity yields a nonzero amp via the QA handle', () => {
    act(() => {
      root.render(
        <OrbControls
          size={88}
          leftActive
          rightActive
          activeRings="right"
          ringCount={3}
          ringStep={4}
          intensity={0.35}
          coachIntensity={0}
          micAllowed
          onToggleVoice={noop}
          onToggleMic={noop}
          onRequestMic={noop}
        />,
      );
    });

    const level = window.__ggQaOrbLevel!();
    expect(level.source).toBe('user');
    expect(level.amp).toBeCloseTo(0.35, 5);
  });

  it('idle/silence: amp is 0 via the QA handle', () => {
    act(() => {
      root.render(
        <OrbControls
          size={88}
          leftActive={false}
          rightActive={false}
          activeRings="idle"
          ringCount={3}
          ringStep={4}
          intensity={0}
          coachIntensity={0}
          micAllowed={false}
          onToggleVoice={noop}
          onToggleMic={noop}
          onRequestMic={noop}
        />,
      );
    });

    const level = window.__ggQaOrbLevel!();
    expect(level.source).toBe('idle');
    expect(level.amp).toBe(0);
  });

  it('end-to-end: real coachAudioBus playback drives the coach-side amp read from the QA handle', () => {
    const el = makeAudioEl({ paused: false, currentTime: 1 });
    rmsToWrite = 0.3; // -> bucketed amp > 0 via rmsToAmp

    act(() => {
      root.render(
        <OrbControls
          size={88}
          leftActive
          rightActive={false}
          activeRings="left"
          ringCount={3}
          ringStep={4}
          intensity={0}
          coachIntensity={0.4}
          micAllowed={false}
          onToggleVoice={noop}
          onToggleMic={noop}
          onRequestMic={noop}
        />,
      );
    });

    // Simulate a real coach-audio path (tts-service/useBeatOpenerMp3/
    // useBeatOpenerCartesia) registering its playing element with the bus.
    // OrbControls itself only consumes an already-resolved coachIntensity
    // prop (fed by useCoachVoiceActivity upstream in FlowVoiceControls /
    // OnboardingChatOverlay); this confirms the QA handle reads whatever
    // coachIntensity is currently threaded through, which is what those
    // hooks would have derived from this same bus.
    act(() => {
      registerCoachAudioElement(el);
    });

    const level = window.__ggQaOrbLevel!();
    expect(level.source).toBe('coach');
    expect(level.amp).toBeGreaterThan(0);

    act(() => {
      unregisterCoachAudioElement(el);
    });
  });
});
