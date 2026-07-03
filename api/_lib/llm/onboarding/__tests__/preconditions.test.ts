import { describe, expect, it } from 'vitest';
import { checkAdvanceData } from '../preconditions.js';

// V3 persist scale (steps are beat identities, not positions — parity with the
// generated flow locked by src/onboarding-flow/__tests__/stepMapParity.test.ts):
// 1 age+gender · 2 path · 3 category/braindump · 4 goals (advanced: habits) ·
// 5 habits (both habit beats) · 6 state-check · 7 morningCheckin ·
// 8 reflectionConfig · ≥9 pass (no V3 beat).
const HABITS = { foo: { days: [1], time: '09:00', reminder: true } };
const base = { path: null as string | null, brainDumpRaw: null as string | null };

function gate(sourceStep: number, data: Record<string, unknown>, over: Partial<typeof base> = {}) {
  return checkAdvanceData({ sourceStep, data, ...base, ...over });
}

describe('checkAdvanceData — canonical resync tail', () => {
  it('case 5 (leaving habit-select) requires habitConfigs', () => {
    expect(gate(5, {})).toMatch(/habits_missing/);
    expect(gate(5, { habitConfigs: HABITS })).toBeNull();
  });

  it('case 6 (leaving state-check) requires stateCheck or checkin — NOT habits', () => {
    expect(gate(6, {})).toMatch(/state_check_missing/);
    expect(gate(6, { stateCheck: { sleep: 3 } })).toBeNull();
    // the card tap writes the same beat under `checkin`
    expect(gate(6, { checkin: { mood: 4 } })).toBeNull();
    // Habits present but no state-check must still fail (state-check is
    // pre-fork in V3; habits do not exist yet when it advances).
    expect(gate(6, { habitConfigs: HABITS })).toMatch(/state_check_missing/);
  });

  it('case 7 (leaving morning-setup) requires morningCheckin', () => {
    expect(gate(7, {})).toMatch(/morning_checkin_missing/);
    expect(gate(7, { morningCheckin: { time: '07:30', days: [1], reminder: true } })).toBeNull();
  });

  it('case 8 (leaving reflection) requires reflectionConfig', () => {
    expect(gate(8, {})).toMatch(/reflection_missing/);
    expect(gate(8, { reflectionConfig: { time: '21:00', days: [1], reminder: true } })).toBeNull();
  });

  it('case ≥9 passes through (no V3 beat on the legacy plan-review scale)', () => {
    expect(gate(9, {})).toBeNull();
    expect(gate(10, {})).toBeNull();
  });

  it('case 4 on the advanced lane gates on habitConfigs (advanced-frequency), not goals', () => {
    expect(gate(4, {}, { path: 'braindump' })).toMatch(/habits_missing/);
    expect(gate(4, { habitConfigs: HABITS }, { path: 'braindump' })).toBeNull();
  });

  it('spine cases 1-4: case 1 gates on age + gender (nickname captured at auth)', () => {
    expect(gate(1, {})).toMatch(/age_missing/);
    // age-only is not sufficient — gender is required too
    expect(gate(1, { age: 28 })).toMatch(/gender_missing/);
    // nickname absent is fine once age + gender are in
    expect(gate(1, { age: 28, gender: 'Male' })).toBeNull();
    expect(gate(2, {}, { path: null })).toMatch(/path_missing/);
    expect(gate(2, {}, { path: 'simple' })).toBeNull();
    expect(gate(3, {})).toMatch(/category_or_braindump_missing/);
    expect(gate(3, { category: 'Sleep better' })).toBeNull();
    expect(gate(3, {}, { brainDumpRaw: 'I want to sleep more' })).toBeNull();
    expect(gate(4, {})).toMatch(/goals_missing/);
    expect(gate(4, { goals: ['x'] })).toBeNull();
  });
});
