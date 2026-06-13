import { describe, expect, it } from 'vitest';
import { goalsByCategory } from '@gg/shared/data/onboardingGoals';
import { ONBOARDING_TOOL_ADDENDUM } from '../systemPromptAddendum.js';
import { CATEGORY_OPTIONS, ONBOARDING_TOOLS } from '../schemas.js';

describe('onboarding tool registry', () => {
  it('exposes exactly the thirteen expected tools', () => {
    expect(ONBOARDING_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        'add_habit',
        'advance_step',
        'ask_clarification',
        'confirm_plan',
        'remove_habit',
        'submit_brain_dump',
        'submit_category',
        'submit_custom_prompts',
        'submit_goals',
        'submit_path_choice',
        'submit_profile',
        'submit_reflection_config',
        'update_habit',
      ].sort(),
    );
  });
});

describe('ONBOARDING_TOOL_ADDENDUM', () => {
  it('makes advance_step the same-turn nav tool and keeps the required-fields guard', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('advance_step');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/SAME-TURN LAW/);
    expect(ONBOARDING_TOOL_ADDENDUM).toContain(
      'NEVER call advance_step if required fields for the screen are still missing',
    );
    expect(ONBOARDING_TOOL_ADDENDUM).not.toContain('confirm_step_complete');
  });

  it('steers plan-review to confirm_plan, not advance_step', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('confirm_plan');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/PLAN REVIEW/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/call confirm_plan — NOT advance_step/);
  });

  it('keeps the path-fork synonyms and verbatim brain-dump rule', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('submit_path_choice');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/BRAIN DUMP/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/verbatim/i);
  });

  it('forbids reading on-screen options aloud and re-listing them', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/ON-SCREEN OPTIONS ARE BUTTONS/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/do NOT read the option list aloud/i);
  });

  it('generalizes same-turn advance to no-data screens and forbids "ready to move on?"', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/screens with NO data tool/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/FORBIDDEN on every screen/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(
      /target_step is ALWAYS the current screen's step \+ 1/,
    );
  });

  it('keeps an ambiguity guard that calls ask_clarification before advancing', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/AMBIGUITY GUARD/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/ask_clarification/);
  });

  it('forbids pre-narrating the next screen after a change', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('STAY ON THIS SCREEN AFTER A CHANGE');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/begin the NEXT screen's task|start the next one/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/overrides the BEHAVIOR block/i);
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
