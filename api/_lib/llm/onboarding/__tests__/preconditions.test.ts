import { describe, expect, it } from 'vitest';
import { checkAdvanceData } from '../preconditions.js';

// V3 persist scale (steps are beat identities, not positions — parity with the
// generated flow locked by src/onboarding-flow/__tests__/stepMapParity.test.ts):
// 1 age+gender · 2 path · 3 category/braindump · 4 goals (advanced: habits) ·
// 5 habits (both habit beats) · 6 state-check · 7 morningCheckin ·
// 8 reflectionConfig · 9 weeklyConfig · ≥10 pass (no V3 beat).
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

  it('case 6 beginner (leaving habit-schedule at stored step 6) requires habits, NOT state-check (B50)', () => {
    // The stored step runs one ahead across the shared persist step 5, so on
    // the beginner lane the beat being LEFT at 6 is habit-schedule. Gating it
    // on state-check data (the NEXT beat, cannot exist yet) deadlocked the
    // flow and told the model to call record_checkin on a beat where that tool
    // is not exposed; it then rerouted the check-in into add_habit and hit
    // max_habits_reached ("habit limit reached" on check-in save).
    expect(gate(6, { habitConfigs: HABITS })).toBeNull();
    expect(gate(6, { habitConfigs: HABITS }, { path: 'simple' })).toBeNull();
    expect(gate(6, {}, { path: 'simple' })).toMatch(/habits_missing/);
    // state-check data alone (no habits) must NOT unlock the advance out of
    // habit-schedule.
    expect(gate(6, { stateCheck: { sleep: 3 } }, { path: 'simple' })).toMatch(/habits_missing/);
  });

  it('case 6 advanced keeps the state-check identity gate (no window beat displays at 6)', () => {
    expect(gate(6, {}, { path: 'braindump' })).toMatch(/state_check_missing/);
    expect(gate(6, { stateCheck: { sleep: 3 } }, { path: 'braindump' })).toBeNull();
    // the card tap writes the same beat under `checkin`
    expect(gate(6, { checkin: { mood: 4 } }, { path: 'braindump' })).toBeNull();
  });

  it('case 7 (leaving morning-setup) requires morningCheckin', () => {
    expect(gate(7, {})).toMatch(/morning_checkin_missing/);
    expect(gate(7, { morningCheckin: { time: '07:30', days: [1], reminder: true } })).toBeNull();
  });

  it('case 7: the explicit-refusal skip marker satisfies the gate (B58 follow-up)', () => {
    // config_refused_by_user persists morningCheckinSkipped=true as a terminal
    // answer; without this skip path the beat is inescapable and the model
    // retries submit_morning_checkin on later turns, where unrelated time/day
    // content can slip past the guard and save a refused config.
    expect(gate(7, { morningCheckinSkipped: true })).toBeNull();
    // strictly the marker — falsy or wrong-typed truthy values stay gated
    expect(gate(7, { morningCheckinSkipped: false })).toMatch(/morning_checkin_missing/);
    expect(gate(7, { morningCheckinSkipped: 'yes' })).toMatch(/morning_checkin_missing/);
    // a real config still passes regardless of the marker
    expect(
      gate(7, {
        morningCheckin: { time: '07:30', days: [1], reminder: true },
        morningCheckinSkipped: true,
      }),
    ).toBeNull();
  });

  it('case 8 (leaving reflection) requires reflectionConfig', () => {
    expect(gate(8, {})).toMatch(/reflection_missing/);
    expect(gate(8, { reflectionConfig: { time: '21:00', days: [1], reminder: true } })).toBeNull();
  });

  it('case 9 (leaving weekly-day-setup) requires weeklyConfig', () => {
    expect(gate(9, {})).toMatch(/weekly_config_missing/);
    expect(gate(9, { weeklyConfig: { day: 0 } })).toBeNull();
  });

  it('case ≥10 passes through (no V3 beat on the legacy plan-review scale)', () => {
    expect(gate(10, {})).toBeNull();
    expect(gate(11, {})).toBeNull();
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
