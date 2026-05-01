import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAnalytics, track, trackPageView } from '@/analytics/posthog';
import { _setCurrentInputMethodForProvider } from '@/contexts/inputMethodContextDef';

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: captureMock,
    identify: vi.fn(),
    people: { set: vi.fn() },
    reset: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

beforeEach(() => {
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  initAnalytics();
  captureMock.mockClear();
  _setCurrentInputMethodForProvider('manual');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('track() input_method auto-attach', () => {
  it('attaches the current input_method when none provided', () => {
    _setCurrentInputMethodForProvider('voice');
    track('complete_signup');

    expect(captureMock).toHaveBeenCalledWith(
      'complete_signup',
      { input_method: 'voice' },
      undefined,
    );
  });

  it('preserves caller-provided input_method (caller wins)', () => {
    _setCurrentInputMethodForProvider('voice');
    track('complete_signup', { input_method: 'manual' });

    expect(captureMock).toHaveBeenCalledWith(
      'complete_signup',
      { input_method: 'manual' },
      undefined,
    );
  });

  it('merges other properties alongside input_method', () => {
    _setCurrentInputMethodForProvider('voice');
    track('view_screen', { screen: 'home' });

    expect(captureMock).toHaveBeenCalledWith(
      'view_screen',
      { input_method: 'voice', screen: 'home' },
      undefined,
    );
  });

  it('does NOT attach input_method to $pageview', () => {
    _setCurrentInputMethodForProvider('voice');
    trackPageView('/home');

    expect(captureMock).toHaveBeenCalledWith('$pageview', { path: '/home' }, undefined);
  });

  it("defaults to 'manual' when no Provider has set a value", () => {
    track('open_app');

    expect(captureMock).toHaveBeenCalledWith('open_app', { input_method: 'manual' }, undefined);
  });
});
