import { describe, expect, it } from 'vitest';
import { goalsByCategory } from '@gg/shared/data/onboardingGoals';
import { ONBOARDING_TOOL_ADDENDUM } from '../systemPromptAddendum.js';
import { CATEGORY_OPTIONS, ONBOARDING_TOOLS } from '../schemas.js';

describe('onboarding tool registry', () => {
  it('exposes exactly the sixteen expected tools', () => {
    expect(ONBOARDING_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        'add_habit',
        'advance_step',
        'ask_clarification',
        'confirm_plan',
        'record_checkin',
        'remove_habit',
        'submit_brain_dump',
        'submit_category',
        'submit_custom_prompts',
        'submit_goals',
        'submit_morning_checkin',
        'submit_path_choice',
        'submit_profile',
        'submit_reflection_config',
        'submit_weekly_config',
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

  it('locks the check-in-is-not-a-habit rule (B50)', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('THE CHECK-IN IS NOT A HABIT');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(
      /NEVER call add_habit or update_habit to create or store a check-in/,
    );
  });

  it('steers the final confirm screen to confirm_plan, not advance_step', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('confirm_plan');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/PLAN CONFIRM \(ONBOARD-COMPLETE/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/call confirm_plan — NOT advance_step/);
  });

  it('keeps the path-fork synonyms and verbatim brain-dump rule', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('submit_path_choice');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/BRAIN DUMP/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/verbatim/i);
  });

  it('forbids pre-narrating the next screen after a change', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('STAY ON THIS SCREEN AFTER A CHANGE');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/begin the NEXT screen's task|start the next one/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/overrides the BEHAVIOR block/i);
  });

  it('recites the options on a direct ask but keeps the unprompted default', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/READ OPTIONS ON REQUEST/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/Do not recite the on-screen options unprompted/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/DIRECTLY asks to hear them/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/read them to me/i);
  });

  it('documents the B58 setup-config guard error codes in ERROR RECOVERY', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('config_refused_by_user');
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('config_not_grounded');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/never say you set it up/i);
  });

  it('adds the B59 mirror rule: no false-failure narration alongside the no-false-success rule', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('DATA INTEGRITY (six rules, no exceptions)');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/MIRROR THE TOOL RESULT, IN BOTH DIRECTIONS/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/never a false success and never a false failure/i);
  });

  // B60 correction priority. The tester trail: the user said "work more", the
  // transcript (or the coach) heard "walk more", the user corrected ("I said
  // work more") and the coach asserted its own guess back ("It sounds like you
  // meant to say 'walk more.' Let's stick with that.") and built the next
  // question on the wrong goal.
  it('adds the correction-priority rule: an explicit user correction outranks the coach reading (B60)', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(
      /AN EXPLICIT USER CORRECTION OUTRANKS YOUR READING OF THEIR WORDS/,
    );
    // the exact tester shape is the worked example
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('"I said work more, not walk more"');
    // semantics 1: wins immediately, verbatim, and flows into tool args
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/correction wins immediately/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/adopt the corrected words verbatim/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/every tool call from that point on/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/re-call the same tool with the corrected value/i);
    // the observed failure phrasing is named as the anti-pattern
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/NEVER assert your own guess over a correction/);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/it sounds like you meant to say/i);
    // semantics 2: garbled input gets ONE clarifying question, never an asserted guess
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/genuinely garbled or ambiguous/i);
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/ONE short clarifying question/);
  });

  // B60 must be additive: the guards from !478/!490/!493/!496 stay intact.
  it('keeps the earlier integrity guards intact alongside the correction rule (B60 no-weakening)', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('config_refused_by_user');
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('config_not_grounded');
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('path_choice_not_grounded');
    expect(ONBOARDING_TOOL_ADDENDUM).toContain('habit_name_ungrounded');
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(
      /their own words outrank a suggestion of yours even when their reply back to you was a plain "yes"/,
    );
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(/MIRROR THE TOOL RESULT, IN BOTH DIRECTIONS/);
  });

  it('updates the habit_name_ungrounded guidance so user content outranks a coach proposal (B59)', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toMatch(
      /their own words outrank a suggestion of yours even when their reply back to you was a plain "yes"/,
    );
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
