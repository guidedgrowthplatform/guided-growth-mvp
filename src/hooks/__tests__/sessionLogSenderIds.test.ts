import { describe, expect, it } from 'vitest';
import {
  SESSION_LOG_SCREEN_ID_CANONICAL,
  resolveOnboardingBeatId,
  resolveSessionLogScreenId,
} from '@gg/shared/onboarding/beatIds';

function navigationPayload(fromScreen: string, toScreen: string) {
  return {
    event: 'navigate',
    payload: { from_screen: fromScreen, to_screen: toScreen, trigger: 'tap' },
    screenId: toScreen,
  };
}

function onboardingPayload(sourceScreenId: string) {
  const screenId = resolveSessionLogScreenId(sourceScreenId) ?? sourceScreenId;
  return { event: 'form_submit', payload: { screen_id: screenId }, screenId };
}

function realtimeVoicePayload(screen?: string) {
  const canonicalScreenId = !screen
    ? undefined
    : screen in SESSION_LOG_SCREEN_ID_CANONICAL
      ? resolveSessionLogScreenId(screen)
      : resolveSessionLogScreenId(screen.toUpperCase().replace(/_/g, '-'));

  return {
    voiceAnchorScreenId: canonicalScreenId,
    variableValues: { canonical_screen_id: canonicalScreenId ?? '' },
  };
}

function screenMapValue(screenId: string) {
  return resolveOnboardingBeatId(screenId) ?? screenId;
}

describe('session-log sender ID compatibility', () => {
  it('snapshots the payloads emitted by the four verified senders', () => {
    const onboardingStepLabels = {
      1: 'ONBOARD-01',
      2: 'ONBOARD-FORK',
      3: 'ONBOARD-BEGINNER-01',
      4: 'ONBOARD-BEGINNER-02',
      5: 'ONBOARD-BEGINNER-03',
      6: 'ONBOARD-BEGINNER-04',
      7: 'STARTING-PLAN',
    } as const;

    expect({
      navigate: navigationPayload('ONBOARD-01', screenMapValue('onboard_02')),
      onboarding: Object.fromEntries(
        Object.entries(onboardingStepLabels).map(([step, screenId]) => [
          step,
          onboardingPayload(screenId),
        ]),
      ),
      realtimeVoice: realtimeVoicePayload('onboard_04'),
      screenMap: {
        legacyRouteScreenId: screenMapValue('onboard_advanced_results'),
        unknownRouteScreenId: screenMapValue('HOME-DASHBOARD'),
        feedbackRouteScreenId: screenMapValue('feedback'),
      },
    }).toMatchSnapshot();
  });

  it('keeps unknown values and explicit drops compatible', () => {
    expect(resolveSessionLogScreenId('HOME-DASHBOARD')).toBe('HOME-DASHBOARD');
    expect(resolveSessionLogScreenId('feedback')).toBeUndefined();
  });
});
