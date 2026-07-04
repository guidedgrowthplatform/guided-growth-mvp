import { describe, expect, it } from 'vitest';
import { ONBOARDING_TOOLS, ONBOARDING_TOOL_NAMES, isOnboardingToolName } from '../schemas.js';
import { getOnboardingTools, isOnboardingScreen } from '../registry.js';

describe('ONBOARDING_TOOLS', () => {
  it('exposes the sixteen canonical tool names', () => {
    expect(ONBOARDING_TOOLS.map((t) => t.name).sort()).toEqual([
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

  it('submit_profile has no required field (nickname captured at auth)', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'submit_profile')!;
    expect(tool.parameters.required).toEqual([]);
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

  it('ask_clarification requires a message and writes no enum', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'ask_clarification')!;
    expect(tool.parameters.required).toEqual(['message']);
    expect(tool.parameters.properties.message.type).toBe('string');
  });

  it('submit_category enum has 8 categories', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'submit_category')!;
    const enumVals = tool.parameters.properties.category.enum;
    expect(enumVals).toHaveLength(8);
    expect(enumVals).toContain('Sleep better');
    expect(enumVals).toContain('Break bad habits');
  });

  it('add_habit requires only name — other fields are server-defaulted (Vapi parity)', () => {
    const tool = ONBOARDING_TOOLS.find((t) => t.name === 'add_habit')!;
    expect(tool.parameters.required).toEqual(['name']);
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
          "required": [],
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
            "habit_type",
            "name",
            "reminder",
            "schedule",
            "time",
          ],
          "required": [
            "name",
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
          "name": "update_habit",
          "properties": [
            "days",
            "name",
            "reminder",
            "schedule",
            "time",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "submit_morning_checkin",
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
          "name": "record_checkin",
          "properties": [
            "energy",
            "mood",
            "sleep",
            "stress",
          ],
          "required": [],
        },
        {
          "name": "submit_reflection_config",
          "properties": [
            "days",
            "mode",
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
          "name": "submit_weekly_config",
          "properties": [
            "day",
          ],
          "required": [
            "day",
          ],
        },
        {
          "name": "submit_custom_prompts",
          "properties": [
            "prompts",
          ],
          "required": [
            "prompts",
          ],
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
        {
          "name": "advance_step",
          "properties": [
            "target_step",
          ],
          "required": [
            "target_step",
          ],
        },
        {
          "name": "confirm_plan",
          "properties": [
            "reason",
          ],
          "required": [],
        },
        {
          "name": "ask_clarification",
          "properties": [
            "message",
          ],
          "required": [
            "message",
          ],
        },
      ]
    `);
  });
});

describe('ONBOARDING_TOOL_NAMES + isOnboardingToolName', () => {
  it('set contains exactly the sixteen names', () => {
    expect(ONBOARDING_TOOL_NAMES.size).toBe(16);
  });

  it('isOnboardingToolName accepts known names', () => {
    expect(isOnboardingToolName('submit_profile')).toBe(true);
    expect(isOnboardingToolName('add_habit')).toBe(true);
    expect(isOnboardingToolName('advance_step')).toBe(true);
  });

  it('isOnboardingToolName rejects unknown / base tool names', () => {
    expect(isOnboardingToolName('update_profile')).toBe(false);
    expect(isOnboardingToolName('navigate_next')).toBe(false);
    expect(isOnboardingToolName('whatever')).toBe(false);
    expect(isOnboardingToolName('')).toBe(false);
  });
});

const names = (tools: readonly { name: string }[] | undefined) =>
  (tools ?? []).map((t) => t.name).sort();

describe('getOnboardingTools / isOnboardingScreen', () => {
  it("gates to each beat's allowed tools (per-beat tool gating)", () => {
    expect(names(getOnboardingTools('ONBOARD-01--FORM'))).toEqual([
      'advance_step',
      'submit_profile',
    ]);
    expect(names(getOnboardingTools('ONBOARD-BEGINNER-03'))).toEqual([
      'add_habit',
      'advance_step',
      'remove_habit',
    ]);
    expect(names(getOnboardingTools('ONBOARD-ADVANCED'))).toEqual([
      'advance_step',
      'submit_brain_dump',
    ]);
    expect(names(getOnboardingTools('ONBOARD-WEEKLY-SETUP'))).toEqual([
      'advance_step',
      'submit_weekly_config',
    ]);
  });

  it('exposes no tools on the silent auth beat', () => {
    expect(getOnboardingTools('ONBOARD-AUTH--FORM')).toEqual([]);
  });

  it('falls back to all tools for an ONBOARD- beat not in beatContexts', () => {
    expect(getOnboardingTools('ONBOARD-NOT-A-BEAT-99')).toBe(ONBOARDING_TOOLS);
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
