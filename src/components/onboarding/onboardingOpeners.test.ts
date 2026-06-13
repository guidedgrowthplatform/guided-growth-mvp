import { describe, expect, it } from 'vitest';
import type { OnboardingState, OnboardingStepData } from '@gg/shared/types';
import { getOnboardingOpener, getOnboardingRevisitOpener } from './onboardingOpeners';

function makeState(
  over: Partial<OnboardingState> & { data?: OnboardingStepData },
): OnboardingState {
  return {
    id: 'id',
    anon_id: 'anon',
    path: null,
    status: 'in_progress',
    current_step: 1,
    data: {},
    completed_at: null,
    created_at: '',
    updated_at: '',
    chat_session_id: null,
    ...over,
  };
}

describe('getOnboardingRevisitOpener', () => {
  it('returns null for null state', () => {
    expect(getOnboardingRevisitOpener('ONBOARD-01--FORM', null)).toBeNull();
  });

  it('returns null for an untouched step', () => {
    expect(getOnboardingRevisitOpener('ONBOARD-01--FORM', makeState({ data: {} }))).toBeNull();
  });

  it('returns null for an unknown screen', () => {
    const state = makeState({ data: { nickname: 'Alex' } });
    expect(getOnboardingRevisitOpener('ONBOARD-NOPE', state)).toBeNull();
  });

  it('all ONBOARD-01 fields present → complete recap with every value', () => {
    const state = makeState({
      data: { nickname: 'Alex', age: 41, gender: 'Male', referralSource: 'Pondering White' },
    });
    const opener = getOnboardingRevisitOpener('ONBOARD-01--FORM', state);
    expect(opener?.complete).toBe(true);
    expect(opener?.text).toContain('Alex');
    expect(opener?.text).toContain('41');
    expect(opener?.text).toContain('Male');
    expect(opener?.text).toContain('Pondering White');
    expect(opener?.text).toContain('move on');
  });

  it('partial ONBOARD-01 → incomplete recap that names the gaps and omits "move on"', () => {
    const state = makeState({ data: { nickname: 'Alex', age: 41 } });
    const opener = getOnboardingRevisitOpener('ONBOARD-01--FORM', state);
    expect(opener?.complete).toBe(false);
    expect(opener?.text).toContain('Alex');
    expect(opener?.text).toContain('41');
    expect(opener?.text).toContain('I still need');
    expect(opener?.text).toContain('how you identify');
    expect(opener?.text).toContain('how you found us');
    expect(opener?.text).not.toContain('move on');
  });

  it('FORK with a path chosen → complete, mapped to user-facing label', () => {
    const opener = getOnboardingRevisitOpener(
      'ONBOARD-FORK--FORM',
      makeState({ path: 'braindump' }),
    );
    expect(opener?.complete).toBe(true);
    expect(opener?.text).toContain('advanced');
    expect(opener?.text).not.toContain('braindump');
  });

  it('BEGINNER-01 with a category → complete recap', () => {
    const opener = getOnboardingRevisitOpener(
      'ONBOARD-BEGINNER-01',
      makeState({ data: { category: 'Health' } }),
    );
    expect(opener?.complete).toBe(true);
    expect(opener?.text).toContain('Health');
  });
});

describe('getOnboardingOpener coverage', () => {
  it.each([
    'ONBOARD-01--FORM',
    'ONBOARD-FORK--FORM',
    'ONBOARD-BEGINNER-01',
    'ONBOARD-BEGINNER-02',
    'ONBOARD-BEGINNER-03',
    'ONBOARD-BEGINNER-07',
    'ONBOARD-BEGINNER-06',
    'ONBOARD-ADVANCED',
    'ONBOARD-ADVANCED-02',
    'ONBOARD-ADVANCED-04',
    'ONBOARD-ADVANCED-05',
    'ONBOARD-ADV-CUSTOM',
  ])('%s has a non-empty opener', (screenId) => {
    const opener = getOnboardingOpener(screenId);
    expect(opener && opener.length > 0).toBe(true);
  });
});
