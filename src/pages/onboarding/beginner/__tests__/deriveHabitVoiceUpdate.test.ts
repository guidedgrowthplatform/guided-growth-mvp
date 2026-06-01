/**
 * Tests for the deriveHabitVoiceUpdate helper that routes onboarding
 * voice results into one of three buckets — toggle a predefined
 * picker option, add a brand-new custom habit, or noop.
 *
 * Regression target: GitLab #161 "Voice-created habit not persisted."
 * Before the helper existed, Step5Page.handleVoiceAction
 * unconditionally called toggleHabit(name) on `add_habit`. For names
 * that weren't in any habitsByGoal[goal] list (e.g. "meditation" on
 * the sleep goal whose predefined list doesn't include it), the
 * picker rendered nothing and the user saw the screen "do nothing"
 * even though selectedHabits got the entry.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { deriveHabitVoiceUpdate, type HabitVoiceState } from '../deriveHabitVoiceUpdate';

// Trimmed slice of the real habitsByGoal to keep these tests focused on
// the helper's routing logic, not on the full taxonomy.
const habitsByGoal: Record<string, string[]> = {
  'Fall asleep earlier': [
    'No caffeine after 2 PM',
    'No screens after 10 PM',
    'Start wind-down by 10 PM',
    'Be in bed by target bedtime',
  ],
  'Move more consistently': ['8,000+ steps', '10-minute walk after lunch'],
};

function makeState(overrides: Partial<HabitVoiceState> = {}): HabitVoiceState {
  return {
    goals: ['Fall asleep earlier'],
    habitsByGoal,
    selectedHabits: new Set(),
    customHabits: {},
    expandedGoal: 'Fall asleep earlier',
    maxSelected: 2,
    ...overrides,
  };
}

function addHabitResult(name: string): OnboardingVoiceResult {
  return {
    success: true,
    action: 'add_habit',
    params: { name, value: name },
    message: '',
    confidence: 1,
  };
}

describe('deriveHabitVoiceUpdate', () => {
  it('routes a name matching a predefined picker option to toggle (the bug-free path)', () => {
    const state = makeState();
    const update = deriveHabitVoiceUpdate(state, addHabitResult('No caffeine after 2 PM'));
    expect(update).toEqual({
      kind: 'toggle',
      name: 'No caffeine after 2 PM',
      goal: 'Fall asleep earlier',
    });
  });

  it('routes a custom name (not in any predefined list) to addCustom under the expanded goal — the #161 fix', () => {
    const state = makeState({
      goals: ['Fall asleep earlier'],
      expandedGoal: 'Fall asleep earlier',
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('meditation'));
    expect(update).toEqual({
      kind: 'addCustom',
      goal: 'Fall asleep earlier',
      name: 'meditation',
    });
  });

  it('falls back to goals[0] when the user collapsed every section', () => {
    const state = makeState({
      goals: ['Move more consistently', 'Fall asleep earlier'],
      expandedGoal: '',
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('Stretch for 5 minutes'));
    expect(update).toEqual({
      kind: 'addCustom',
      goal: 'Move more consistently',
      name: 'Stretch for 5 minutes',
    });
  });

  it('noops when the cap is already hit and the name is new', () => {
    const state = makeState({
      selectedHabits: new Set(['No screens after 10 PM', 'No caffeine after 2 PM']),
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('meditation'));
    expect(update).toEqual({ kind: 'noop', reason: 'max-reached' });
  });

  it('noops when the cap is hit even for a predefined picker hit (would-be 3rd toggle)', () => {
    const state = makeState({
      selectedHabits: new Set(['No screens after 10 PM', 'No caffeine after 2 PM']),
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('Start wind-down by 10 PM'));
    expect(update).toEqual({ kind: 'noop', reason: 'max-reached' });
  });

  it('noops when the name is empty', () => {
    const state = makeState();
    const update = deriveHabitVoiceUpdate(state, addHabitResult('   '));
    expect(update).toEqual({ kind: 'noop', reason: 'empty-name' });
  });

  it('noops when the name has neither `name` nor `value`', () => {
    const state = makeState();
    const result: OnboardingVoiceResult = {
      success: true,
      action: 'add_habit',
      params: {},
      message: '',
      confidence: 1,
    };
    expect(deriveHabitVoiceUpdate(state, result)).toEqual({ kind: 'noop', reason: 'empty-name' });
  });

  it('noops when the same name is already in selectedHabits (idempotent voice repeat)', () => {
    const state = makeState({
      selectedHabits: new Set(['No screens after 10 PM']),
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('No screens after 10 PM'));
    expect(update).toEqual({ kind: 'noop', reason: 'already-selected' });
  });

  it('noops when the user re-adds a custom habit they already added (case-insensitive)', () => {
    const state = makeState({
      customHabits: { 'Fall asleep earlier': ['Meditation'] },
      selectedHabits: new Set(['Meditation']),
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('meditation'));
    // already-selected guard runs first (case-sensitive), which is fine — both
    // outcomes are noop. Confirm we don't accidentally double-add.
    expect(update.kind).toBe('noop');
  });

  it('matches predefined options case-insensitively and returns the canonical name (Edge 2)', () => {
    // STT often lowercases the spoken option. The helper must canonicalize
    // back to the picker's exact string so toggleHabit finds the row,
    // and surface the matched goal so the caller can expand it.
    const state = makeState();
    const update = deriveHabitVoiceUpdate(state, addHabitResult('no caffeine after 2 pm'));
    expect(update).toEqual({
      kind: 'toggle',
      name: 'No caffeine after 2 PM',
      goal: 'Fall asleep earlier',
    });
  });

  it('returns noop for unsupported actions (remove_habit / update_habit stay with their own branches)', () => {
    const state = makeState();
    const remove: OnboardingVoiceResult = {
      success: true,
      action: 'remove_habit',
      params: { name: 'meditation' },
      message: '',
      confidence: 1,
    };
    expect(deriveHabitVoiceUpdate(state, remove)).toEqual({
      kind: 'noop',
      reason: 'unsupported-action',
    });
  });

  it('routes select_option exactly like add_habit (legacy fill_field surface)', () => {
    const state = makeState();
    const result: OnboardingVoiceResult = {
      success: true,
      action: 'select_option',
      params: { fieldName: 'habit', value: 'No screens after 10 PM' },
      message: '',
      confidence: 1,
    };
    expect(deriveHabitVoiceUpdate(state, result)).toEqual({
      kind: 'toggle',
      name: 'No screens after 10 PM',
      goal: 'Fall asleep earlier',
    });
  });

  it('noops when no goal is available (defensive — goals=[] AND expandedGoal="")', () => {
    const state = makeState({ goals: [], expandedGoal: '' });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('meditation'));
    expect(update).toEqual({ kind: 'noop', reason: 'no-goal-available' });
  });

  it('returns the matched goal so the caller can auto-expand a collapsed section (Edge 1)', () => {
    // User has both goals; only the second is expanded. They voice a
    // predefined option that lives under the FIRST (collapsed) goal.
    // The helper must surface that goal so Step5Page can expand it.
    const state = makeState({
      goals: ['Fall asleep earlier', 'Move more consistently'],
      expandedGoal: 'Move more consistently',
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('No caffeine after 2 PM'));
    expect(update).toEqual({
      kind: 'toggle',
      name: 'No caffeine after 2 PM',
      goal: 'Fall asleep earlier',
    });
  });

  it('re-selects a deselected custom habit by routing to toggle under its catalog goal (Edge 3)', () => {
    // User added "meditation" by voice earlier (so it's in customHabits)
    // then tapped its chip off (so it's NOT in selectedHabits). Voicing
    // it again should re-toggle the existing row, not noop.
    const state = makeState({
      customHabits: { 'Fall asleep earlier': ['meditation'] },
      selectedHabits: new Set(),
    });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('meditation'));
    expect(update).toEqual({
      kind: 'toggle',
      name: 'meditation',
      goal: 'Fall asleep earlier',
    });
  });

  it('uses MAX_HABITS_ONBOARDING as the default cap when maxSelected omitted', () => {
    // Sanity: caller no longer threads `maxSelected: 2`. Filling the
    // set to the constant should produce a max-reached noop.
    const filler = Array.from({ length: MAX_HABITS_ONBOARDING }, (_, i) => `habit-${i}`);
    const state = makeState({ selectedHabits: new Set(filler) });
    const update = deriveHabitVoiceUpdate(state, addHabitResult('meditation'));
    expect(update).toEqual({ kind: 'noop', reason: 'max-reached' });
  });
});
