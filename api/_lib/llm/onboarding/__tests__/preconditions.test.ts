import { describe, expect, it } from 'vitest';
import { checkAdvanceData } from '../preconditions.js';

// Canonical resync step model (docs/step-0-canonical-step-table.md):
// 1 nickname · 2 path · 3 category/braindump · 4 goals · 5 habits ·
// 6 habits (habit-schedule) · 7 plan-review (pass) · 8 morningCheckin ·
// 9 reflectionConfig · ≥10 pass.
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

  it('case 6 (leaving habit-schedule) requires habitConfigs — NOT reflection', () => {
    expect(gate(6, {})).toMatch(/habits_missing/);
    expect(gate(6, { habitConfigs: HABITS })).toBeNull();
    // The old model gated case 6 on reflectionConfig; that would strand the
    // habit-schedule beat. Reflection present but no habits must still fail.
    expect(gate(6, { reflectionConfig: { time: '21:00', days: [1], reminder: true } })).toMatch(
      /habits_missing/,
    );
  });

  it('case 7 (leaving plan-review) is a pass-through', () => {
    expect(gate(7, {})).toBeNull();
  });

  it('case 8 (leaving morning) requires morningCheckin', () => {
    expect(gate(8, {})).toMatch(/morning_checkin_missing/);
    expect(gate(8, { morningCheckin: { time: '07:30', days: [1], reminder: true } })).toBeNull();
  });

  it('case 9 (leaving reflection) requires reflectionConfig', () => {
    expect(gate(9, {})).toMatch(/reflection_missing/);
    expect(gate(9, { reflectionConfig: { time: '21:00', days: [1], reminder: true } })).toBeNull();
  });

  it('case ≥10 passes through', () => {
    expect(gate(10, {})).toBeNull();
  });

  it('spine cases 1-4: case 1 now requires both nickname AND gender', () => {
    expect(gate(1, {})).toMatch(/profile_missing/);
    // nickname-only is no longer sufficient — gender is required too
    expect(gate(1, { nickname: 'Yo' })).toMatch(/gender_missing/);
    expect(gate(1, { nickname: 'Yo', gender: 'Male' })).toBeNull();
    expect(gate(2, {}, { path: null })).toMatch(/path_missing/);
    expect(gate(2, {}, { path: 'simple' })).toBeNull();
    expect(gate(3, {})).toMatch(/category_or_braindump_missing/);
    expect(gate(3, { category: 'Sleep better' })).toBeNull();
    expect(gate(3, {}, { brainDumpRaw: 'I want to sleep more' })).toBeNull();
    expect(gate(4, {})).toMatch(/goals_missing/);
    expect(gate(4, { goals: ['x'] })).toBeNull();
  });
});
