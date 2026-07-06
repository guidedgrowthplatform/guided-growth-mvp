/**
 * A5: the goals->habits branch rule. Two goals = one habit per goal (replace
 * inside a goal); one goal = up to the total cap.
 */
import { describe, expect, it } from 'vitest';
import { nextHabitSelection } from './habitSelectionRules';

const HABITS_BY_GOAL: Record<string, string[]> = {
  'Sleep better': ['No screens after 10pm', 'Wind-down routine'],
  'Move more': ['Morning walk', 'Stretch break'],
};

const base = {
  goals: ['Sleep better', 'Move more'],
  habitsByGoal: HABITS_BY_GOAL,
  expandedGoal: 'Sleep better',
  maxTotal: 2,
};

describe('nextHabitSelection (two goals: one habit per goal)', () => {
  it('allows one pick per goal, two total', () => {
    let sel = nextHabitSelection({ ...base, prev: new Set(), habit: 'Morning walk' });
    sel = nextHabitSelection({ ...base, prev: sel, habit: 'No screens after 10pm' });
    expect([...sel].sort()).toEqual(['Morning walk', 'No screens after 10pm']);
  });

  it('replaces the pick inside the same goal instead of blocking', () => {
    const prev = new Set(['No screens after 10pm', 'Morning walk']);
    const sel = nextHabitSelection({ ...base, prev, habit: 'Wind-down routine' });
    expect([...sel].sort()).toEqual(['Morning walk', 'Wind-down routine']);
  });

  it('deselects on a second toggle of the same habit', () => {
    const prev = new Set(['Morning walk']);
    expect(nextHabitSelection({ ...base, prev, habit: 'Morning walk' }).size).toBe(0);
  });

  it('attributes an unlisted (custom) habit to the expanded goal', () => {
    const prev = new Set(['No screens after 10pm']);
    const sel = nextHabitSelection({ ...base, prev, habit: 'Evening tea ritual' });
    // Custom name under the expanded Sleep better panel replaces its pick.
    expect([...sel]).toEqual(['Evening tea ritual']);
  });
});

describe('nextHabitSelection (one goal: up to the total cap)', () => {
  const oneGoal = { ...base, goals: ['Sleep better'] };

  it('allows two picks under the single goal', () => {
    let sel = nextHabitSelection({ ...oneGoal, prev: new Set(), habit: 'No screens after 10pm' });
    sel = nextHabitSelection({ ...oneGoal, prev: sel, habit: 'Wind-down routine' });
    expect(sel.size).toBe(2);
  });

  it('caps at maxTotal without replacing', () => {
    const prev = new Set(['No screens after 10pm', 'Wind-down routine']);
    const sel = nextHabitSelection({ ...oneGoal, prev, habit: 'Morning walk' });
    expect([...sel].sort()).toEqual(['No screens after 10pm', 'Wind-down routine'].sort());
  });
});
