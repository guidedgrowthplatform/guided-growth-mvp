/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { Habit, HabitCompletion } from '@/lib/services/data-service.interface';
import { buildWeekGrid, trailingWeekDates, trailingWeekDayLabels } from '../useWeekData.mapper';

function habit(name: string, scheduleDays: number[] | null = null, id = name): Habit {
  return {
    id,
    name,
    frequency: 'daily',
    scheduleDays,
    habitType: 'binary_do',
    createdAt: '2026-01-01T00:00:00.000Z',
    active: true,
  };
}

function completion(
  habitId: string,
  date: string,
  status: 'done' | 'missed' = 'done',
): HabitCompletion {
  return { id: `${habitId}-${date}`, habitId, date, completedAt: `${date}T08:00:00Z`, status };
}

describe('trailingWeekDates', () => {
  it('returns 7 dates, oldest-first, ending on today (inclusive)', () => {
    const today = new Date(2026, 5, 10); // June 10 2026 local
    const dates = trailingWeekDates(today);
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe('2026-06-10');
    expect(dates[0]).toBe('2026-06-04');
  });

  it('handles a month boundary', () => {
    const today = new Date(2026, 5, 2); // June 2 2026
    const dates = trailingWeekDates(today);
    expect(dates[0]).toBe('2026-05-27');
    expect(dates[6]).toBe('2026-06-02');
  });
});

describe('trailingWeekDayLabels', () => {
  it('matches trailingWeekDates order with one-letter labels', () => {
    // 2026-06-10 is a Wednesday.
    const today = new Date(2026, 5, 10);
    const labels = trailingWeekDayLabels(today);
    expect(labels).toHaveLength(7);
    expect(labels[6]).toBe('W'); // today, Wednesday
  });
});

describe('buildWeekGrid', () => {
  const windowDates = trailingWeekDates(new Date(2026, 5, 10)); // ends Wed 2026-06-10

  it('marks a done row as done and counts it toward overall', () => {
    const habits = [habit('Walk')];
    const completions = [completion('Walk', windowDates[6], 'done')];
    const grid = buildWeekGrid(habits, completions, windowDates);
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].cells[6]).toBe('done');
    expect(grid.rows[0].done).toBe(1);
    expect(grid.overallDone).toBe(1);
  });

  it('marks a missed row as missed', () => {
    const habits = [habit('Walk')];
    const completions = [completion('Walk', windowDates[6], 'missed')];
    const grid = buildWeekGrid(habits, completions, windowDates);
    expect(grid.rows[0].cells[6]).toBe('missed');
    expect(grid.rows[0].done).toBe(0);
  });

  it('marks a scheduled day with no completion row as gap', () => {
    const habits = [habit('Walk')]; // scheduleDays null = every day
    const grid = buildWeekGrid(habits, [], windowDates);
    expect(grid.rows[0].cells.every((c) => c === 'gap')).toBe(true);
    expect(grid.rows[0].scheduled).toBe(7);
    expect(grid.rows[0].done).toBe(0);
  });

  it('marks an unscheduled day as off, not counted toward scheduled', () => {
    // windowDates[6] = Wed 2026-06-10, dow = 3. Schedule only Mon(1)/Fri(5).
    const habits = [habit('Gym', [1, 5])];
    const grid = buildWeekGrid(habits, [], windowDates);
    expect(grid.rows[0].cells[6]).toBe('off');
    expect(grid.rows[0].scheduled).toBeLessThan(7);
  });

  it('computes overallPercent from done/scheduled across all rows', () => {
    const habits = [habit('Walk', [3]), habit('Read', [3])]; // both scheduled only on Wed (dow 3)
    const completions = [completion('Walk', windowDates[6], 'done')];
    const grid = buildWeekGrid(habits, completions, windowDates);
    expect(grid.overallScheduled).toBe(2);
    expect(grid.overallDone).toBe(1);
    expect(grid.overallPercent).toBe(50);
  });

  it('returns 0 percent with no scheduled days at all', () => {
    const grid = buildWeekGrid([], [], windowDates);
    expect(grid.overallPercent).toBe(0);
    expect(grid.overallScheduled).toBe(0);
  });

  it('scheduleDays null/empty means scheduled every day (cadence-default)', () => {
    const habits = [habit('Walk', null), habit('Read', [])];
    const grid = buildWeekGrid(habits, [], windowDates);
    expect(grid.rows[0].scheduled).toBe(7);
    expect(grid.rows[1].scheduled).toBe(7);
  });
});
