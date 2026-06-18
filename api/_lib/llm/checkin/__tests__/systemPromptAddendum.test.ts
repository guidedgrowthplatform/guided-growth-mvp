import { describe, expect, it } from 'vitest';
import {
  CHECKIN_TOOL_ADDENDUM,
  CHECKIN_READONLY_ADDENDUM,
  buildEveningWalkthrough,
  buildEveningOpener,
  buildMorningOpener,
  buildMorningFlow,
} from '../systemPromptAddendum.js';
import { CHECKIN_SCRIPTS, pickVariation } from '../scriptVariations.js';
import { isCheckinScreen, isReadOnlyCheckinScreen } from '../registry.js';

const DAY = '2026-06-18';

describe('CHECKIN_TOOL_ADDENDUM', () => {
  it('names every domain tool so the model knows its scope', () => {
    for (const name of [
      'create_habit',
      'complete_habit',
      'record_checkin',
      'start_focus',
      'log_metric',
      'query_habits',
      'get_summary',
      'suggest_habit',
    ]) {
      expect(CHECKIN_TOOL_ADDENDUM).toContain(name);
    }
  });

  it('states that navigate_next/update_profile are NOT available here', () => {
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/navigate_next/);
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/do not have|NOT have|do NOT/i);
  });

  it('instructs eager tool calls + brevity', () => {
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/eager/i);
    expect(CHECKIN_TOOL_ADDENDUM).toMatch(/not_found/);
  });
});

describe('CHECKIN_READONLY_ADDENDUM', () => {
  it('maps read-back to query_habits with scope:"all" and not from memory', () => {
    expect(CHECKIN_READONLY_ADDENDUM).toMatch(/read back my habits/i);
    expect(CHECKIN_READONLY_ADDENDUM).toContain('query_habits');
    expect(CHECKIN_READONLY_ADDENDUM).toContain('scope:"all"');
    expect(CHECKIN_READONLY_ADDENDUM).toMatch(/never answer from memory/i);
  });

  it('maps how-was-my-week to get_summary and keeps exact names', () => {
    expect(CHECKIN_READONLY_ADDENDUM).toMatch(/how was my week/i);
    expect(CHECKIN_READONLY_ADDENDUM).toContain('get_summary');
    expect(CHECKIN_READONLY_ADDENDUM).toMatch(/EXACT/);
  });
});

describe('buildMorningOpener (scripted, rotating)', () => {
  const block = buildMorningOpener(DAY);
  it('calls query_checkin to surface the 4-scale card', () => {
    expect(block).toContain('query_checkin');
  });
  it("injects the day's greeting + state prompt verbatim", () => {
    expect(block).toContain(pickVariation('morning_greeting', DAY));
    expect(block).toContain(pickVariation('morning_state_prompt', DAY));
  });
  it('insists on word-for-word, no improvising', () => {
    expect(block).toMatch(/word-for-word/i);
  });
  it('is deterministic for a given day', () => {
    expect(buildMorningOpener(DAY)).toBe(block);
  });
});

describe('buildMorningFlow (are-you-done gate + wrap)', () => {
  const block = buildMorningFlow(DAY);
  it('includes the rotating are-you-done line, only if partial', () => {
    expect(block).toContain(pickVariation('are_you_done', DAY));
    expect(block).toMatch(/only if partial/i);
  });
  it('wraps with the rotating morning wrap line', () => {
    expect(block).toContain(pickVariation('morning_wrap', DAY));
  });
  it('never starts a reflection — morning is state-only', () => {
    expect(block).toMatch(/never (coach|start a reflection)/i);
  });
});

describe('buildEveningOpener (scripted, rotating)', () => {
  const block = buildEveningOpener(DAY);
  it('calls query_habits scope:"today"', () => {
    expect(block).toContain('query_habits');
    expect(block).toContain('scope:"today"');
  });
  it("injects the day's greeting+habits and habit prompt verbatim", () => {
    expect(block).toContain(pickVariation('evening_greeting_habits', DAY));
    expect(block).toContain(pickVariation('evening_habit_prompt', DAY));
  });
});

describe('buildEveningWalkthrough (scripted flow + fixed reflection)', () => {
  const block = buildEveningWalkthrough(DAY);
  it('sequences habits → reflection → wrap in order', () => {
    const habits = block.search(/### 1\. Habits/);
    const reflection = block.search(/### 2\. Reflection/);
    const wrap = block.search(/### 3\. Wrap/);
    expect(habits).toBeGreaterThanOrEqual(0);
    expect(reflection).toBeGreaterThan(habits);
    expect(wrap).toBeGreaterThan(reflection);
  });
  it('fires the are-you-done gate only if some habits are pending', () => {
    expect(block).toContain(pickVariation('are_you_done', DAY));
    expect(block).toMatch(/only if partial/i);
  });
  it('uses the THREE fixed reflection prompts verbatim and calls log_reflection', () => {
    expect(block).toContain(CHECKIN_SCRIPTS.reflection_proud[0]);
    expect(block).toContain(CHECKIN_SCRIPTS.reflection_forgive[0]);
    expect(block).toContain(CHECKIN_SCRIPTS.reflection_grateful[0]);
    expect(block).toContain('log_reflection');
  });
  it('ends with the rotating evening wrap line', () => {
    expect(block).toContain(pickVariation('evening_wrap', DAY));
  });
  it('insists on word-for-word, no improvising', () => {
    expect(block).toMatch(/word-for-word/i);
  });
  it('still records chat-stated completions via complete_habit with polarity', () => {
    expect(block).toContain('complete_habit');
    expect(block).toMatch(/avoid/i);
  });
});

describe('read-only addendum gating mirrors the registry predicate', () => {
  it('read-only screens are addendum-eligible but NOT dedicated check-in screens', () => {
    for (const id of ['HOME-FIRST', 'HOME-MORNING', 'ECHECK-06']) {
      expect(isReadOnlyCheckinScreen(id)).toBe(true);
      expect(isCheckinScreen(id)).toBe(false);
    }
  });

  it('dedicated check-in screens get the full addendum, never the read-only one (no double-emit)', () => {
    for (const id of ['HOME-CHECKIN', 'MCHECK-01', 'ECHECK-01']) {
      expect(isCheckinScreen(id)).toBe(true);
      expect(isReadOnlyCheckinScreen(id)).toBe(false);
    }
  });

  it('non-checkin (onboarding) screens get neither addendum', () => {
    expect(isCheckinScreen('ONBOARD-01--FORM')).toBe(false);
    expect(isReadOnlyCheckinScreen('ONBOARD-01--FORM')).toBe(false);
  });
});
