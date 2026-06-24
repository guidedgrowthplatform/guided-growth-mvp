import { describe, it, expect } from 'vitest';
import { getOnboardingOpener } from '@/components/onboarding/onboardingOpeners';

describe('getOnboardingOpener — seeded chat bubbles', () => {
  it('has a coach line for the profile beat', () => {
    expect(getOnboardingOpener('ONBOARD-01--FORM')).toBeTruthy();
  });

  it('profile copy does not reference typing (the text composer was removed)', () => {
    const copy = getOnboardingOpener('ONBOARD-01--FORM') ?? '';
    expect(copy.toLowerCase()).not.toContain('type it here');
  });

  it('auth beat has no opener (its card carries the heading; coach stays silent)', () => {
    expect(getOnboardingOpener('ONBOARD-AUTH--FORM')).toBeUndefined();
  });
});
