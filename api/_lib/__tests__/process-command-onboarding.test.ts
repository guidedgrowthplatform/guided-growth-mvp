import { describe, expect, it } from 'vitest';
import { buildOnboardingPrompt } from '../llm/onboardingPrompt';

describe('buildOnboardingPrompt', () => {
  it('includes the screen_id when provided', () => {
    const prompt = buildOnboardingPrompt({
      step: 3,
      screen_id: 'ONBOARD-BEGINNER-01',
      prompt: 'What feels most worth improving?',
      options: ['Sleep better', 'Move more'],
    });
    expect(prompt).toContain('ONBOARD-BEGINNER-01');
  });

  it('lists the action vocabulary the LLM is allowed to emit', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
    });
    for (const action of [
      'fill_field',
      'select_option',
      'select_multiple',
      'add_habit',
      'update_habit',
      'remove_habit',
      'set_reflection_config',
      'set_path',
      'confirm_plan',
      'navigate_next',
    ]) {
      expect(prompt).toContain(action);
    }
  });

  it('has a per-screen block for ONBOARD-BEGINNER-01 (Category) listing select_option', () => {
    const prompt = buildOnboardingPrompt({
      step: 3,
      screen_id: 'ONBOARD-BEGINNER-01',
      options: ['Sleep better', 'Move more', 'Eat better'],
      prompt: 'What feels most worth improving?',
    });
    // The per-screen heading uses the canonical bundle ID
    expect(prompt).toMatch(/ONBOARD-BEGINNER-01[\s\S]*select_option[\s\S]*category/);
  });

  it('has a per-screen block for ONBOARD-BEGINNER-03 (Habits) listing add_habit / remove_habit', () => {
    const prompt = buildOnboardingPrompt({
      step: 5,
      screen_id: 'ONBOARD-BEGINNER-03',
      options: [],
      prompt: '',
    });
    expect(prompt).toMatch(/ONBOARD-BEGINNER-03[\s\S]*add_habit/);
    expect(prompt).toMatch(/ONBOARD-BEGINNER-03[\s\S]*remove_habit/);
  });

  it('includes the focused-field disambiguation block when a focused field is supplied', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
      focusedField: { name: 'nickname', value: '', type: 'text' },
    });
    expect(prompt).toContain('Focused Field');
    expect(prompt).toContain('nickname');
  });

  it('omits the focused-field block when no focused field is supplied', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
    });
    expect(prompt).not.toContain('Focused Field');
  });

  it('emits the Already-Filled Fields section when filled_fields is non-empty', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
      filled_fields: {
        nickname: 'Sam',
        age: 28,
        gender: 'Male',
      },
    });
    expect(prompt).toContain('## Already-Filled Fields');
    expect(prompt).toContain('- nickname: Sam');
    expect(prompt).toContain('- age: 28');
    expect(prompt).toContain('- gender: Male');
  });

  it('omits the Already-Filled Fields section when filled_fields is absent or empty', () => {
    const prompt1 = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
    });
    const prompt2 = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
      filled_fields: {},
    });
    expect(prompt1).not.toContain('Already-Filled Fields');
    expect(prompt2).not.toContain('Already-Filled Fields');
  });

  it('skips undefined / null / empty values inside filled_fields', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
      filled_fields: {
        nickname: 'Sam',
        age: undefined,
        gender: null,
        referralSource: '',
        goals: [],
        habitConfigs: {},
      },
    });
    expect(prompt).toContain('- nickname: Sam');
    expect(prompt).not.toContain('age:');
    expect(prompt).not.toContain('gender:');
    expect(prompt).not.toContain('referralSource:');
    expect(prompt).not.toContain('goals:');
    expect(prompt).not.toContain('habitConfigs:');
  });

  it('includes natural-language synonyms for set_path on ONBOARD-FORK--FORM', () => {
    const prompt = buildOnboardingPrompt({
      step: 2,
      screen_id: 'ONBOARD-FORK--FORM',
      options: [],
      prompt: '',
    });
    // The two on-screen card labels must be documented so the LLM can map
    // a phrase like "new to this" to path=simple (the user-reported bug).
    expect(prompt).toContain("I'm new to habit tracking");
    expect(prompt).toContain('I already have experience with habit tracking');
    // Synonyms that should resolve to simple
    expect(prompt).toMatch(/simple\s*←[\s\S]*new to this/);
    expect(prompt).toMatch(/simple\s*←[\s\S]*beginner/);
    // Synonyms that should resolve to braindump
    expect(prompt).toMatch(/braindump\s*←[\s\S]*experienced/);
    expect(prompt).toMatch(/braindump\s*←[\s\S]*brain dump/);
    // Explicit override permission for path when intent is clear
    expect(prompt).toMatch(/set_path SHOULD overwrite the previously-filled path/);
  });

  it('JSON-stringifies nested objects and arrays inside filled_fields', () => {
    const prompt = buildOnboardingPrompt({
      step: 5,
      screen_id: 'ONBOARD-BEGINNER-03',
      options: [],
      prompt: '',
      filled_fields: {
        goals: ['Fall asleep earlier', 'Sleep deeper'],
        habitConfigs: { Meditation: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true } },
      },
    });
    expect(prompt).toContain('- goals: ["Fall asleep earlier","Sleep deeper"]');
    expect(prompt).toContain('Meditation');
    expect(prompt).toContain('"time":"07:00"');
  });
});
