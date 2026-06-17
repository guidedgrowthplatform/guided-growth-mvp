import { describe, expect, it } from 'vitest';
import {
  CHECKIN_TOOL_ADDENDUM,
  CHECKIN_READONLY_ADDENDUM,
  CHECKIN_WALKTHROUGH,
  CHECKIN_EVENING_OPENER,
} from '../systemPromptAddendum.js';
import { isCheckinScreen, isReadOnlyCheckinScreen } from '../registry.js';

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

describe('CHECKIN_WALKTHROUGH', () => {
  it('starts by enumerating today-scheduled habits via query_habits scope:"today"', () => {
    expect(CHECKIN_WALKTHROUGH).toContain('query_habits');
    expect(CHECKIN_WALKTHROUGH).toContain('scope:"today"');
  });

  it('surfaces an interactive checklist and records chat-stated completions via complete_habit', () => {
    expect(CHECKIN_WALKTHROUGH).toContain('complete_habit');
    expect(CHECKIN_WALKTHROUGH).toMatch(/interactive/i);
    expect(CHECKIN_WALKTHROUGH).toMatch(/checklist/i);
    expect(CHECKIN_WALKTHROUGH).toMatch(/one at a time/i);
  });

  it('handles polarity: avoid abstained = success, slip = unmarked miss', () => {
    expect(CHECKIN_WALKTHROUGH).toMatch(/avoid/i);
    expect(CHECKIN_WALKTHROUGH).toMatch(/abstain/i);
    expect(CHECKIN_WALKTHROUGH).toMatch(/unmarked/i);
  });

  it('closes the habit phase with a warm acknowledgement, never guilt', () => {
    expect(CHECKIN_WALKTHROUGH).toMatch(/acknowledge/i);
    expect(CHECKIN_WALKTHROUGH).toMatch(/never guilt/i);
  });

  it('sequences all three phases: habits → reflection → wrap-up, in order', () => {
    const habits = CHECKIN_WALKTHROUGH.search(/Phase 1 — Habits/);
    const reflection = CHECKIN_WALKTHROUGH.search(/Phase 2 — Reflection/);
    const wrapUp = CHECKIN_WALKTHROUGH.search(/Phase 3 — Wrap-up/);
    expect(habits).toBeGreaterThanOrEqual(0);
    expect(reflection).toBeGreaterThan(habits);
    expect(wrapUp).toBeGreaterThan(reflection);
  });

  it('makes reflection mandatory and defers questions to the Reflection Settings block', () => {
    expect(CHECKIN_WALKTHROUGH).toMatch(/mandatory/i);
    expect(CHECKIN_WALKTHROUGH).toContain('log_reflection');
    expect(CHECKIN_WALKTHROUGH).toContain('## Reflection Settings (this user)');
  });

  it('ends with a warm bedtime wrap-up', () => {
    expect(CHECKIN_WALKTHROUGH).toMatch(/bedtime|rest well|tomorrow/i);
  });
});

describe('CHECKIN_EVENING_OPENER', () => {
  it('calls query_habits scope:"today" to surface the interactive checklist', () => {
    expect(CHECKIN_EVENING_OPENER).toContain('query_habits');
    expect(CHECKIN_EVENING_OPENER).toContain('scope:"today"');
    expect(CHECKIN_EVENING_OPENER).toMatch(/interactive|checklist/i);
  });

  it('opens warm and explicitly does NOT lead with a reflection question', () => {
    expect(CHECKIN_EVENING_OPENER).toMatch(/warm/i);
    expect(CHECKIN_EVENING_OPENER).toMatch(/do not open with a reflection question/i);
  });

  it('falls back to reflection only when there are no habits today', () => {
    expect(CHECKIN_EVENING_OPENER).toMatch(/no habits/i);
    expect(CHECKIN_EVENING_OPENER).toContain('## Reflection Settings (this user)');
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
