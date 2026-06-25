import { describe, expect, it } from 'vitest';
import {
  CHECKIN_TOOL_ADDENDUM,
  CHECKIN_READONLY_ADDENDUM,
  buildEveningWalkthrough,
  buildEveningOpener,
  buildMorningOpener,
  buildMorningFlow,
  buildScriptedDiscipline,
} from '../systemPromptAddendum.js';
import { CHECKIN_SCRIPTS } from '@gg/shared/checkin/scriptVariations';
import { isCheckinScreen, isReadOnlyCheckinScreen } from '../registry.js';

const containsOneOf = (block: string, pool: readonly string[]): boolean =>
  pool.some((line) => block.includes(line));

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
  const block = buildMorningOpener();
  it('calls query_checkin to surface the 4-scale card', () => {
    expect(block).toContain('query_checkin');
  });
  it('injects a greeting + state prompt from the pools verbatim', () => {
    expect(containsOneOf(block, CHECKIN_SCRIPTS.morning_greeting)).toBe(true);
    expect(containsOneOf(block, CHECKIN_SCRIPTS.morning_state_prompt)).toBe(true);
  });
  it('insists on word-for-word, no improvising', () => {
    expect(block).toMatch(/word-for-word/i);
  });
});

describe('buildMorningFlow (are-you-done gate + wrap)', () => {
  const block = buildMorningFlow();
  it('includes a rotating are-you-done line, only if partial', () => {
    expect(containsOneOf(block, CHECKIN_SCRIPTS.are_you_done)).toBe(true);
    expect(block).toMatch(/only if partial/i);
  });
  it('wraps with a rotating morning wrap line', () => {
    expect(containsOneOf(block, CHECKIN_SCRIPTS.morning_wrap)).toBe(true);
  });
  it('never starts a reflection — morning is state-only', () => {
    expect(block).toMatch(/never (coach|start a reflection)/i);
  });
});

describe('buildEveningOpener (scripted, rotating)', () => {
  const block = buildEveningOpener();
  it('calls query_habits scope:"today"', () => {
    expect(block).toContain('query_habits');
    expect(block).toContain('scope:"today"');
  });
  it('injects a greeting+habits and habit prompt from the pools verbatim', () => {
    expect(containsOneOf(block, CHECKIN_SCRIPTS.evening_greeting_habits)).toBe(true);
    expect(containsOneOf(block, CHECKIN_SCRIPTS.evening_habit_prompt)).toBe(true);
  });
});

describe('buildEveningWalkthrough (scripted flow + CONFIGURABLE reflection)', () => {
  const block = buildEveningWalkthrough();
  it('sequences habits → reflection → wrap in order', () => {
    const habits = block.search(/### 1\. Habits/);
    const reflection = block.search(/### 2\. Reflection/);
    const wrap = block.search(/### 3\. Wrap/);
    expect(habits).toBeGreaterThanOrEqual(0);
    expect(reflection).toBeGreaterThan(habits);
    expect(wrap).toBeGreaterThan(reflection);
  });
  it('fires the are-you-done gate only if some habits are pending', () => {
    expect(containsOneOf(block, CHECKIN_SCRIPTS.are_you_done)).toBe(true);
    expect(block).toMatch(/only if partial/i);
  });
  it("defers the reflection to the user's configured questions, NOT hardcoded prompts", () => {
    expect(block).toContain('## Reflection Settings (this user)');
    expect(block).toContain('log_reflection');
    expect(block).not.toContain(CHECKIN_SCRIPTS.reflection_proud[0]);
  });
  it('ends with a rotating evening wrap line', () => {
    expect(containsOneOf(block, CHECKIN_SCRIPTS.evening_wrap)).toBe(true);
  });
  it('insists on word-for-word, no improvising', () => {
    expect(block).toMatch(/word-for-word/i);
  });
  it('still records chat-stated completions via complete_habit with polarity', () => {
    expect(block).toContain('complete_habit');
    expect(block).toMatch(/avoid/i);
  });
  it('enforces an explicit per-habit walk: one at a time, confirm did/did-not, factual recap', () => {
    expect(block).toMatch(/one habit at a time|one at a time/i);
    expect(block).toMatch(/for each habit/i);
    expect(block).toMatch(/did it or did not|did.+did not/i);
    expect(block).toMatch(/done.+pending|done vs pending/i);
  });
});

describe('buildScriptedDiscipline (no improvisation)', () => {
  const block = buildScriptedDiscipline();
  it('forbids commentary/coaching and overrides the warmth guidance', () => {
    expect(block).toMatch(/no coaching/i);
    expect(block).toMatch(/no commentary/i);
    expect(block).toMatch(/overrides/i);
  });
  it('allows only the scripted acknowledgment pool, verbatim', () => {
    for (const ack of CHECKIN_SCRIPTS.acknowledgment) {
      expect(block).toContain(ack);
    }
  });
  it('says to call tools silently, never narrating them', () => {
    expect(block).toMatch(/silently|never narrate/i);
  });
  it('requires self-locating the current scripted step every turn (#241)', () => {
    expect(block).toMatch(/every turn/i);
    expect(block).toMatch(/locate which scripted step|skip ahead/i);
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
