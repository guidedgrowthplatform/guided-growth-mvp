/**
 * L1-5: the flow registry resolves every published flow by flowId, version-less
 * slug, and pin tag, while the original onboarding loader contract holds.
 */
import { describe, expect, it } from 'vitest';
import { homeTourV1 } from './flows/home-tour-v1';
import { getPublishedFlow, listPublishedFlows, loadPublishedFlow, versionTag } from './useFlow';

describe('flow registry (useFlow)', () => {
  it('resolves check-in flows by flowId, slug, and pin tag (generated docs)', () => {
    const morning = getPublishedFlow('morning-checkin-v1');
    expect(morning?.flowId).toBe('morning-checkin-v1');
    expect(getPublishedFlow('morning-checkin')).toBe(morning);
    expect(morning && getPublishedFlow(versionTag(morning))).toBe(morning);
    expect(getPublishedFlow('evening-checkin')?.flowId).toBe('evening-checkin-v1');
    expect(getPublishedFlow('home-tour')).toBe(homeTourV1);
  });

  it('returns undefined for an unknown id (no onboarding fallback in the registry)', () => {
    expect(getPublishedFlow('nope')).toBeUndefined();
  });

  it('keeps the onboarding loader contract: no-arg and unknown pins load onboarding', () => {
    expect(loadPublishedFlow().flowId).toBe('onboarding-beginner-v1');
    expect(loadPublishedFlow('bogus@v9').flowId).toBe('onboarding-beginner-v1');
    // A check-in pin resolves through the same loader (pin format generalizes).
    expect(loadPublishedFlow('morning-checkin-v1@v1').flowId).toBe('morning-checkin-v1');
  });

  it('lists each registered flow exactly once', () => {
    const ids = listPublishedFlows().map((f) => f.flowId);
    expect(ids.length).toBe(new Set(ids).size);
    expect(new Set(ids)).toEqual(
      new Set([
        'onboarding-beginner-v1',
        'morning-checkin-v1',
        'evening-checkin-v1',
        'home-tour-v1',
      ]),
    );
  });
});
