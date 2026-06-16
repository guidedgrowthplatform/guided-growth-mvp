import { describe, expect, it } from 'vitest';
import { CHECKIN_TOOLS, CHECKIN_TOOL_NAMES, isCheckinToolName } from '../schemas.js';
import { getCheckinTools, getReadOnlyCheckinTools, isCheckinScreen } from '../registry.js';

describe('CHECKIN_TOOLS', () => {
  it('exposes the thirteen canonical tool names', () => {
    expect(CHECKIN_TOOLS.map((t) => t.name).sort()).toEqual([
      'complete_habit',
      'create_habit',
      'create_metric',
      'delete_habit',
      'delete_metric',
      'get_summary',
      'log_metric',
      'log_reflection',
      'query_habits',
      'record_checkin',
      'start_focus',
      'suggest_habit',
      'update_habit',
    ]);
  });

  it('every tool has description + valid JSON schema parameters', () => {
    for (const tool of CHECKIN_TOOLS) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.additionalProperties).toBe(false);
      expect(Array.isArray(tool.parameters.required)).toBe(true);
    }
  });

  it('no tool schema includes anon_id — injected from session', () => {
    for (const tool of CHECKIN_TOOLS) {
      expect(Object.keys(tool.parameters.properties)).not.toContain('anon_id');
    }
  });

  it('record_checkin requires nothing (server enforces >=1)', () => {
    const tool = CHECKIN_TOOLS.find((t) => t.name === 'record_checkin')!;
    expect(tool.parameters.required).toEqual([]);
    expect(Object.keys(tool.parameters.properties).sort()).toEqual([
      'energy',
      'mood',
      'sleep',
      'stress',
    ]);
  });

  it('log_metric requires name + value', () => {
    const tool = CHECKIN_TOOLS.find((t) => t.name === 'log_metric')!;
    expect(tool.parameters.required).toEqual(['name', 'value']);
  });

  it('snapshot of schema shape — fails on drift', () => {
    const summary = CHECKIN_TOOLS.map((t) => ({
      name: t.name,
      required: [...t.parameters.required].sort(),
      properties: Object.keys(t.parameters.properties).sort(),
    }));
    expect(summary).toMatchInlineSnapshot(`
      [
        {
          "name": "create_habit",
          "properties": [
            "frequency",
            "habit_type",
            "name",
            "schedule_days",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "complete_habit",
          "properties": [
            "date",
            "dates",
            "name",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "update_habit",
          "properties": [
            "frequency",
            "name",
            "new_name",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "delete_habit",
          "properties": [
            "name",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "create_metric",
          "properties": [
            "input_type",
            "name",
            "scale_max",
            "scale_min",
          ],
          "required": [
            "name",
          ],
        },
        {
          "name": "log_metric",
          "properties": [
            "date",
            "name",
            "value",
          ],
          "required": [
            "name",
            "value",
          ],
        },
        {
          "name": "delete_metric",
          "properties": [
            "name",
          ],
          "required": [
            "name",
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
          "name": "start_focus",
          "properties": [
            "duration",
            "habit",
          ],
          "required": [],
        },
        {
          "name": "query_habits",
          "properties": [
            "name",
            "scope",
          ],
          "required": [],
        },
        {
          "name": "get_summary",
          "properties": [],
          "required": [],
        },
        {
          "name": "suggest_habit",
          "properties": [],
          "required": [],
        },
        {
          "name": "log_reflection",
          "properties": [
            "text",
            "title",
          ],
          "required": [
            "text",
          ],
        },
      ]
    `);
  });
});

describe('CHECKIN_TOOL_NAMES + isCheckinToolName', () => {
  it('set contains exactly thirteen names', () => {
    expect(CHECKIN_TOOL_NAMES.size).toBe(13);
  });

  it('accepts known names, rejects others', () => {
    expect(isCheckinToolName('record_checkin')).toBe(true);
    expect(isCheckinToolName('create_habit')).toBe(true);
    expect(isCheckinToolName('submit_profile')).toBe(false);
    expect(isCheckinToolName('navigate_next')).toBe(false);
    expect(isCheckinToolName('')).toBe(false);
  });
});

describe('getCheckinTools / isCheckinScreen', () => {
  it('returns tools for the explicit check-in conversation screens', () => {
    expect(getCheckinTools('HOME-CHECKIN')).toBe(CHECKIN_TOOLS);
    expect(getCheckinTools('MCHECK-01')).toBe(CHECKIN_TOOLS);
    expect(getCheckinTools('ECHECK-01')).toBe(CHECKIN_TOOLS);
  });

  it('returns undefined for dashboard/onboarding/other screens', () => {
    // Explicit set, NOT a prefix — dashboard HOME-* screens must not get write tools.
    expect(getCheckinTools('HOME-FIRST')).toBeUndefined();
    expect(getCheckinTools('HOME-MORNING')).toBeUndefined();
    expect(getCheckinTools('ONBOARD-01--FORM')).toBeUndefined();
    // Wrap-up + other MCHECK/ECHECK steps are not wired for full tools (only entry screens).
    expect(getCheckinTools('ECHECK-06')).toBeUndefined();
    expect(getCheckinTools(null)).toBeUndefined();
    expect(getCheckinTools(undefined)).toBeUndefined();
    expect(getCheckinTools('')).toBeUndefined();
  });

  it('isCheckinScreen mirrors getCheckinTools', () => {
    expect(isCheckinScreen('HOME-CHECKIN')).toBe(true);
    expect(isCheckinScreen('MCHECK-01')).toBe(true);
    expect(isCheckinScreen('HOME-FIRST')).toBe(false);
    expect(isCheckinScreen(null)).toBe(false);
  });
});

describe('getReadOnlyCheckinTools', () => {
  it('returns [query_habits, get_summary] for dashboard / chat / wrap-up screens', () => {
    const expected = ['get_summary', 'query_habits'];
    expect(
      getReadOnlyCheckinTools('HOME-FIRST')
        ?.map((t) => t.name)
        .sort(),
    ).toEqual(expected);
    expect(
      getReadOnlyCheckinTools('HOME-MORNING')
        ?.map((t) => t.name)
        .sort(),
    ).toEqual(expected);
    expect(
      getReadOnlyCheckinTools('ECHECK-06')
        ?.map((t) => t.name)
        .sort(),
    ).toEqual(expected);
  });

  it('returns undefined for onboarding (owns its own surface) and dedicated check-in screens', () => {
    expect(getReadOnlyCheckinTools('ONBOARD-01--FORM')).toBeUndefined();
    expect(getReadOnlyCheckinTools('ONBOARD-BEGINNER-03')).toBeUndefined();
    // Dedicated check-in screens get the FULL CHECKIN_TOOLS via getCheckinTools; don't double-attach.
    expect(getReadOnlyCheckinTools('HOME-CHECKIN')).toBeUndefined();
    expect(getReadOnlyCheckinTools('MCHECK-01')).toBeUndefined();
    expect(getReadOnlyCheckinTools('ECHECK-01')).toBeUndefined();
    expect(getReadOnlyCheckinTools(null)).toBeUndefined();
    expect(getReadOnlyCheckinTools(undefined)).toBeUndefined();
    expect(getReadOnlyCheckinTools('')).toBeUndefined();
  });
});
