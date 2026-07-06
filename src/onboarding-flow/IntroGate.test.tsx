/** @vitest-environment jsdom */
/**
 * IntroGate mount-gate (B43): a genuinely fresh start must show the
 * coach-greeting overlay even when FlowOnboarding's own nickname-seed write
 * (saveStep(1, { nickname })) lands current_step:1 into the SAME
 * onboarding-state query cache mid-intro. Before the fix, hasProgress was
 * re-derived every render from that live state, so the flow's own
 * bookkeeping write masqueraded as "returning user" and skipped/aborted the
 * greeting. The fix snapshots hasProgress once at mount.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroGate } from './IntroGate';

/* --------------------------------------------------- controllable onboarding state mock */

let currentStep = 0;
const listeners = new Set<() => void>();
function setServerStep(step: number) {
  currentStep = step;
  listeners.forEach((l) => l());
}

vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
      const l = () => force();
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    }, []);
    return { state: { current_step: currentStep } };
  },
}));

// B52: controllable voice preference so tests can assert the greeting clip
// respects voice-off. Defaults to 'voice' (the real DEFAULT_PREFERENCES value).
let voiceMode = 'voice';
vi.mock('@/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { voiceMode } }),
}));

// B46: a fake <audio> element + release() so tests can assert the gate stops
// the clip (pause()) at the onComplete/unmount boundary, not just that
// release() was called.
// B52: `muted` is a real settable property (not just a spy) so the test can
// assert IntroGate's synchronous gesture-frame mute (introMuted ? el.muted =
// true) actually lands on the element startOpenerFromGesture() hands back.
const fakeOpenerEl = { pause: vi.fn(), muted: false };
const fakeOpenerRelease = vi.fn();
vi.mock('./renderer/openerGestureStart', () => ({
  startOpenerFromGesture: () => ({ el: fakeOpenerEl, release: fakeOpenerRelease }),
  blessOpenerClipsInGesture: () => {},
}));

vi.mock('./renderer/openerPreloadPool', () => ({
  preloadOpenerClips: () => {},
}));

vi.mock('./renderer/useBeatOpenerMp3', () => ({
  ONBOARDING_BEAT_MP3S: {},
}));

// Stand-in for the real SplashIntro (audio/orb/timers): a probe that reports
// it mounted and lets the test fire onComplete on demand. B52: also records
// the `muted` prop it was last rendered with, so tests can assert IntroGate
// derives it from the voice preference instead of always passing false.
const completeGreeting = { current: (() => {}) as () => void };
const lastSplashProps: { muted?: boolean } = {};
vi.mock('@/components/welcome/SplashIntro', () => ({
  SplashIntro: ({ onComplete, muted }: { onComplete?: () => void; muted?: boolean }) => {
    completeGreeting.current = () => onComplete?.();
    lastSplashProps.muted = muted;
    return <div data-testid="greeting">greeting-mounted</div>;
  },
}));

/* --------------------------------------------------------------------- fixtures */

let container: HTMLDivElement;
let root: Root;
const INTRO_SEEN_KEY = 'gg_onboarding_intro_seen';

beforeEach(() => {
  currentStep = 0;
  voiceMode = 'voice';
  localStorage.removeItem(INTRO_SEEN_KEY);
  fakeOpenerEl.pause.mockClear();
  fakeOpenerEl.muted = false;
  fakeOpenerRelease.mockClear();
  delete lastSplashProps.muted;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  act(() => {
    root.render(
      <MemoryRouter>
        <IntroGate>
          <div data-testid="chat">chat</div>
        </IntroGate>
      </MemoryRouter>,
    );
  });
}

function clickGetStarted() {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Get started'),
  ) as HTMLButtonElement;
  act(() => btn.click());
}

describe('IntroGate (B43)', () => {
  it("keeps the greeting mounted through the flow's own step-1 nickname-seed write", () => {
    render();
    clickGetStarted();
    expect(container.querySelector('[data-testid="greeting"]')).toBeTruthy();

    // FlowOnboarding's nickname-seed mutation resolves mid-greeting: the
    // SAME onboarding-state cache the fresh session started at climbs to
    // current_step: 1. Before the fix this flipped hasProgress and bailed
    // straight to children, skipping/aborting the greeting.
    act(() => setServerStep(1));
    expect(container.querySelector('[data-testid="greeting"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="chat"]')).toBeNull();

    // The greeting still finishes normally and hands over to chat.
    act(() => completeGreeting.current());
    expect(container.querySelector('[data-testid="chat"]')).toBeTruthy();
  });

  it('still resumes straight to chat for a real returning user (progress already at mount)', () => {
    currentStep = 1;
    render();
    expect(container.querySelector('[data-testid="chat"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="greeting"]')).toBeNull();
  });

  it('skips the intro on a repeat visit (seen-flag set)', () => {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    render();
    expect(container.querySelector('[data-testid="chat"]')).toBeTruthy();
  });

  it('B46: advancing mid-clip stops the greeting clip before the next beat mounts', () => {
    render();
    clickGetStarted();
    expect(container.querySelector('[data-testid="greeting"]')).toBeTruthy();
    // The clip is still "playing" (nothing has paused it yet).
    expect(fakeOpenerEl.pause).not.toHaveBeenCalled();

    // Advance past the greeting mid-clip, exactly like the live repro: the
    // user taps forward while the coach is still speaking.
    act(() => completeGreeting.current());

    // The next beat (children/FlowRenderer) is now mounted...
    expect(container.querySelector('[data-testid="chat"]')).toBeTruthy();
    // ...and the greeting clip was paused before/at that same transition, so
    // it can never be heard overlapping the next beat's own voice.
    expect(fakeOpenerEl.pause).toHaveBeenCalled();
    expect(fakeOpenerRelease).toHaveBeenCalled();
  });

  it('B46: unmounting the gate mid-intro also stops the clip', () => {
    render();
    clickGetStarted();
    expect(container.querySelector('[data-testid="greeting"]')).toBeTruthy();
    expect(fakeOpenerEl.pause).not.toHaveBeenCalled();

    act(() => root.unmount());

    expect(fakeOpenerEl.pause).toHaveBeenCalled();
    expect(fakeOpenerRelease).toHaveBeenCalled();
  });

  it('B52: voice on (default) plays the greeting clip audibly', () => {
    voiceMode = 'voice';
    render();
    clickGetStarted();
    // Muted synchronously, in the same gesture frame, before SplashIntro
    // even renders, not left to the QA-mute default of false-by-omission.
    expect(fakeOpenerEl.muted).toBe(false);
    expect(lastSplashProps.muted).toBe(false);
  });

  it('B52: voice off mutes the greeting clip, both at gesture-start and via the SplashIntro muted prop', () => {
    voiceMode = 'screen';
    render();
    clickGetStarted();
    expect(container.querySelector('[data-testid="greeting"]')).toBeTruthy();
    // The clip startOpenerFromGesture() handed back is muted synchronously in
    // the Get-started click handler, before the caption/orb sequence mounts,
    // closing the window where it could be audible even for one frame.
    expect(fakeOpenerEl.muted).toBe(true);
    // SplashIntro itself also receives muted=true, so its own mute-sync
    // effect (and any fallback path that doesn't adopt the gesture element)
    // stays silent too.
    expect(lastSplashProps.muted).toBe(true);
  });
});
