import { describe, expect, it } from 'vitest';
import type { FlowAnswers } from '../types';
import {
  ADVANCED_HABIT_CAP,
  cadenceLabel,
  habitCapForPath,
  habitConfigsWithAdded,
  habitConfigsWithPatch,
  habitConfigsWithRemoved,
  morningRitual,
  planHabitsFromAnswers,
  reflectionRitual,
  ruleLabel,
  weeklyDay,
  weeklyDayName,
} from './planReviewData';

const baseAnswers: FlowAnswers = {
  path: 'simple',
  habitConfigs: {
    Meditate: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true, schedule: 'Weekday' },
    Workout: { days: [1, 3, 5], time: '18:00', reminder: false },
  },
  reflectionConfig: { time: '21:45', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
  morningCheckin: { time: '08:00', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
  weeklyConfig: { day: 0 },
};

describe('planHabitsFromAnswers', () => {
  it('returns rows in insertion order with defaults filled', () => {
    const rows = planHabitsFromAnswers(baseAnswers);
    expect(rows.map((r) => r.name)).toEqual(['Meditate', 'Workout']);
    expect(rows[0]).toMatchObject({ time: '07:00', reminder: true });
    expect(rows[1]).toMatchObject({ time: '18:00', reminder: false });
  });

  it('normalizes a Set of days to an array', () => {
    const rows = planHabitsFromAnswers({
      habitConfigs: { Read: { days: new Set([0, 6]), time: '09:00', reminder: true } },
    } as unknown as FlowAnswers);
    expect(rows[0].days).toEqual([0, 6]);
  });

  it('returns [] when no habits', () => {
    expect(planHabitsFromAnswers({})).toEqual([]);
  });
});

describe('ritual extractors', () => {
  it('reflectionRitual / morningRitual read the configs', () => {
    expect(reflectionRitual(baseAnswers)).toEqual({
      time: '21:45',
      days: [1, 2, 3, 4, 5],
      reminder: true,
    });
    expect(morningRitual(baseAnswers)).toEqual({
      time: '08:00',
      days: [1, 2, 3, 4, 5],
      reminder: true,
    });
  });

  it('return null when unset', () => {
    expect(reflectionRitual({})).toBeNull();
    expect(morningRitual({})).toBeNull();
  });

  it('weeklyDay reads a valid 0-6 day, else null', () => {
    expect(weeklyDay(baseAnswers)).toBe(0);
    expect(weeklyDay({ weeklyConfig: { day: 9 } } as FlowAnswers)).toBeNull();
    expect(weeklyDay({})).toBeNull();
  });
});

describe('habitCapForPath', () => {
  it('beginner (simple / unset) is the onboarding cap of 2', () => {
    expect(habitCapForPath('simple')).toBe(2);
    expect(habitCapForPath(null)).toBe(2);
    expect(habitCapForPath(undefined)).toBe(2);
  });
  it('advanced (braindump) is the generous ceiling', () => {
    expect(habitCapForPath('braindump')).toBe(ADVANCED_HABIT_CAP);
    expect(ADVANCED_HABIT_CAP).toBeGreaterThan(2);
  });
});

describe('label helpers', () => {
  it('cadenceLabel maps day sets', () => {
    expect(cadenceLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Daily');
    expect(cadenceLabel([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(cadenceLabel([1, 3, 5])).toBe('3 days/week');
  });
  it('ruleLabel reflects the reminder flag', () => {
    expect(ruleLabel('07:00', true)).toBe('Reminder at 07:00');
    expect(ruleLabel('07:00', false)).toBe('At 07:00');
  });
  it('weeklyDayName maps the index', () => {
    expect(weeklyDayName(0)).toBe('Sunday');
    expect(weeklyDayName(6)).toBe('Saturday');
  });
});

describe('habitConfigs edit transforms (full-map replace)', () => {
  it('remove drops the habit (case-insensitive), leaves the rest', () => {
    const next = habitConfigsWithRemoved(baseAnswers, 'meditate');
    expect(Object.keys(next)).toEqual(['Workout']);
  });

  it('remove is a no-op for an unknown name', () => {
    const next = habitConfigsWithRemoved(baseAnswers, 'Nope');
    expect(Object.keys(next)).toEqual(['Meditate', 'Workout']);
  });

  it('patch merges a field and re-derives the schedule label from days', () => {
    const next = habitConfigsWithPatch(baseAnswers, 'Workout', { days: [1, 2, 3, 4, 5] });
    expect(next.Workout).toMatchObject({
      days: [1, 2, 3, 4, 5],
      schedule: 'Weekday',
      time: '18:00',
    });
  });

  it('patch on time keeps days + syncs schedule from existing days', () => {
    const next = habitConfigsWithPatch(baseAnswers, 'Workout', { time: '19:30' });
    expect(next.Workout).toMatchObject({ time: '19:30', days: [1, 3, 5], schedule: 'Custom' });
  });

  it('does not mutate the source answers', () => {
    const before = JSON.stringify(baseAnswers.habitConfigs);
    habitConfigsWithPatch(baseAnswers, 'Workout', { time: '19:30' });
    habitConfigsWithRemoved(baseAnswers, 'Workout');
    expect(JSON.stringify(baseAnswers.habitConfigs)).toBe(before);
  });

  it('add appends a default-config habit', () => {
    const next = habitConfigsWithAdded(baseAnswers, 'Journal');
    expect(Object.keys(next)).toContain('Journal');
    expect(next.Journal).toMatchObject({ time: '09:00', reminder: true, schedule: 'Weekday' });
    expect(next.Journal.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('add is a no-op on a duplicate name (preserves the existing schedule)', () => {
    const next = habitConfigsWithAdded(baseAnswers, 'meditate');
    expect(next.Meditate).toMatchObject({ time: '07:00' });
    expect(Object.keys(next)).toEqual(['Meditate', 'Workout']);
  });

  it('add is a no-op on a blank name', () => {
    const next = habitConfigsWithAdded(baseAnswers, '   ');
    expect(Object.keys(next)).toEqual(['Meditate', 'Workout']);
  });
});
