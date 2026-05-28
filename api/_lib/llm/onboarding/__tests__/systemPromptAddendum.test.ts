import { describe, expect, it } from 'vitest';
import { goalsByCategory } from '@shared/data/onboardingGoals.js';
import { ONBOARDING_TOOL_ADDENDUM } from '../systemPromptAddendum.js';
import { CATEGORY_OPTIONS, ONBOARDING_TOOLS } from '../schemas.js';

describe('onboarding tool registry', () => {
  it('exposes exactly the nine expected tools', () => {
    expect(ONBOARDING_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        'add_habit',
        'confirm_step_complete',
        'remove_habit',
        'submit_brain_dump',
        'submit_category',
        'submit_goals',
        'submit_path_choice',
        'submit_profile',
        'submit_reflection_config',
      ].sort(),
    );
  });
});

describe('ONBOARDING_TOOL_ADDENDUM', () => {
  it('keeps the load-bearing confirm_step_complete rules', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('confirm_step_complete');
    expect(ONBOARDING_TOOL_ADDENDUM).toContain(
      'NEVER call confirm_step_complete in the same turn',
    );
  });

  it('keeps the path-fork synonyms and verbatim brain-dump rule', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('submit_path_choice');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/BRAIN DUMP/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/verbatim/i);
  });
});

describe('goal taxonomy drift guard', () => {
  it('CATEGORY_OPTIONS matches the shared goalsByCategory keys', () => {
    expect([...CATEGORY_OPTIONS].sort()).toEqual(Object.keys(goalsByCategory).sort());
  });

  it('every category has at least one goal', () => {
    for (const goals of Object.values(goalsByCategory)) {
      expect(goals.length).toBeGreaterThan(0);
    }
  });
});
