import { describe, expect, it } from 'vitest';
import { ONBOARDING_TOOLS, ONBOARDING_TOOL_NAMES, isOnboardingToolName } from '../schemas.js';
import { getOnboardingTools, isOnboardingScreen } from '../registry.js';

describe('ONBOARDING_TOOLS', () => {
  it('exposes the nine canonical tool names', () => {
    expect(ONBOARDING_TOOLS.map((t) => t.name).sort()).toEqual([
      'add_habit',
      'confirm_step_complete',
      'remove_habit',
      'submit_brain_dump',
      'submit_category',
      'submit_goals',
      'submit_path_choice',
      'submit_profile',
      'submit_reflection_config',
    ]);
  });

  it('every tool has description + valid JSON schema parameters', () => {
    for (const tool of ONBOARDING_TOOLS) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.additionalProperties).toBe(false);
      expect(Array.isArray(tool.parameters.required)).toBe(true);
    }
  });

  it('no tool schema includes anon_id in properties — injected from session', () => {
    for (const tool of ONBOARDING_TOOLS) {
      expect(Object.keys(tool.parameters.properties)).not.toContain('anon_id');
    }
  });

  it('submit_profile requires only nickname', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'submit_profile')!;
    expect(tool.parameters.required).toEqual(['nickname']);
    expect(tool.parameters.properties.gender).toMatchObject({
      enum: ['Male', 'Female', 'Other'],
    });
  });

  it('submit_path_choice enum is simple|braindump', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'submit_path_choice')!;
    expect(tool.parameters.properties.path).toMatchObject({
      enum: ['simple', 'braindump'],
    });
  });

  it('submit_category enum has 8 categories', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'submit_category')!;
    const enumVals = tool.parameters.properties.category.enum;
    expect(enumVals).toHaveLength(8);
    expect(enumVals).toContain('Sleep better');
    expect(enumVals).toContain('Break bad habits');
  });

  it('add_habit requires the full schedule shape', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'add_habit')!;
    expect(tool.parameters.required).toEqual([
      'name',
      'days',
      'time',
      'reminder',
      'schedule',
    ]);
    expect(tool.parameters.properties.schedule).toMatchObject({
      enum: ['Weekday', 'Weekend', 'Every day'],
    });
  });

  it('snapshot of schema shape — fails on drift', () => {
    const summary = ONBOARDING_TOOLS.map((t) => ({
      name: t.name,
      required: [...t.parameters.required].sort(),
      properties: Object.keys(t.parameters.properties).sort(),
    }));
    expect(summary).toMatchInlineSnapshot(`
      [
        {
          "name": "submit_profile",
          "properties": [
            "age",
            "gender",
            "nickname",
            "referral_source",
          ],
          "required": [
            "nickname",
          ],
        },
        {
          "name": "submit_path_choice",
          "properties": [
            "path",
          ],
          "required": [
            "path",
          ],
        },
        {
          "name": "submit_category",
          "properties": [
            "category",
          ],
          "required": [
            "category",
          ],
        },
        {
          "name": "submit_goals",
          "properties": [
            "goals",
          ],
          "required": [
            "goals",
          ],
        },
        {
          "name": "add_habit",
          "properties": [
            "days",
            "name",
            "reminder",
            "schedule",
            "time",
          ],
          "required": [
            "days",
            "name",
            "reminder",
            "schedule",
            "time",
          ],
        },
        {
          "name": "remove_habit",
          "properties": [
            "name",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "submit_reflection_config",
          "properties": [
            "days",
            "reminder",
            "schedule",
            "time",
          ],
          "required": [
            "days",
            "reminder",
            "schedule",
            "time",
          ],
        },
        {
          "name": "confirm_step_complete",
          "properties": [
            "reason",
          ],
          "required": [],
        },
        {
          "name": "submit_brain_dump",
          "properties": [
            "brain_dump_raw",
          ],
          "required": [
            "brain_dump_raw",
          ],
        },
      ]
    `);
  });
});

describe('ONBOARDING_TOOL_NAMES + isOnboardingToolName', () => {
  it('set contains exactly the nine names', () => {
    expect(ONBOARDING_TOOL_NAMES.size).toBe(9);
  });

  it('isOnboardingToolName accepts known names', () => {
    expect(isOnboardingToolName('submit_profile')).toBe(true);
    expect(isOnboardingToolName('add_habit')).toBe(true);
    expect(isOnboardingToolName('confirm_step_complete')).toBe(true);
  });

  it('isOnboardingToolName rejects unknown / base tool names', () => {
    expect(isOnboardingToolName('update_profile')).toBe(false);
    expect(isOnboardingToolName('navigate_next')).toBe(false);
    expect(isOnboardingToolName('whatever')).toBe(false);
    expect(isOnboardingToolName('')).toBe(false);
  });
});

describe('getOnboardingTools / isOnboardingScreen', () => {
  it('returns tools for ONBOARD- prefixed screen ids', () => {
    expect(getOnboardingTools('ONBOARD-01--FORM')).toBe(ONBOARDING_TOOLS);
    expect(getOnboardingTools('ONBOARD-BEGINNER-03')).toBe(ONBOARDING_TOOLS);
    expect(getOnboardingTools('ONBOARD-ADVANCED')).toBe(ONBOARDING_TOOLS);
  });

  it('returns undefined for non-onboarding screens', () => {
    expect(getOnboardingTools('HOME-FIRST')).toBeUndefined();
    expect(getOnboardingTools('MCHECK-01')).toBeUndefined();
    expect(getOnboardingTools('CHAT')).toBeUndefined();
  });

  it('returns undefined for null/undefined/empty', () => {
    expect(getOnboardingTools(null)).toBeUndefined();
    expect(getOnboardingTools(undefined)).toBeUndefined();
    expect(getOnboardingTools('')).toBeUndefined();
  });

  it('isOnboardingScreen mirrors getOnboardingTools', () => {
    expect(isOnboardingScreen('ONBOARD-01--FORM')).toBe(true);
    expect(isOnboardingScreen('HOME-FIRST')).toBe(false);
    expect(isOnboardingScreen(null)).toBe(false);
  });
});
