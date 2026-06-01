/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { HabitCompletion } from '@/lib/services/data-service.interface';
import { calcCurrentStreak, isHabitVisibleOnDate } from '../useHabitsForDate';

function completion(date: string): HabitCompletion {
  return { id: date, habitId: 'h', date, completedAt: `${date}T08:00:00Z` };
}

describe('calcCurrentStreak', () => {
  it('returns 0 when there are no completions', () => {
    expect(calcCurrentStreak([], '2026-05-01')).toBe(0);
  });

  it('counts a single-day streak ending today', () => {
    expect(calcCurrentStreak([completion('2026-05-01')], '2026-05-01')).toBe(1);
  });

  it('counts consecutive days back from today', () => {
    const dates = ['2026-04-29', '2026-04-30', '2026-05-01'].map(completion);
    expect(calcCurrentStreak(dates, '2026-05-01')).toBe(3);
  });

  it('breaks the streak on a missing day', () => {
    const dates = ['2026-04-28', '2026-04-30', '2026-05-01'].map(completion);
    expect(calcCurrentStreak(dates, '2026-05-01')).toBe(2);
  });

  it('returns 0 when today and yesterday are both missing', () => {
    expect(calcCurrentStreak([completion('2026-04-25')], '2026-05-01')).toBe(0);
  });

  it('deduplicates multiple completions on the same day', () => {
    const dates = [completion('2026-05-01'), completion('2026-05-01'), completion('2026-04-30')];
    expect(calcCurrentStreak(dates, '2026-05-01')).toBe(2);
  });
});

describe('isHabitVisibleOnDate', () => {
  // Tests assume the runtime's local timezone. We pick a UTC offset large
  // enough (12h) so that the "midnight UTC drift" cases stay on the same
  // local calendar day across DST shifts. Each test constructs the
  // createdAt ISO from a deterministic local Date so that the assertion
  // is true regardless of where CI runs.
  function localIsoAt(year: number, monthIdx: number, day: number, hour = 12): string {
    // monthIdx is 0-based (JS Date convention)
    return new Date(year, monthIdx, day, hour, 0, 0).toISOString();
  }

  it('returns true when habit was created on the selected date (inclusive)', () => {
    const createdAt = localIsoAt(2026, 4, 26); // May 26 local
    expect(isHabitVisibleOnDate(createdAt, '2026-05-26')).toBe(true);
  });

  it('returns true for any date after the creation date', () => {
    const createdAt = localIsoAt(2026, 4, 26); // May 26 local
    expect(isHabitVisibleOnDate(createdAt, '2026-05-27')).toBe(true);
    expect(isHabitVisibleOnDate(createdAt, '2026-06-01')).toBe(true);
    expect(isHabitVisibleOnDate(createdAt, '2027-01-01')).toBe(true);
  });

  it('returns false for any date before the creation date — issue #173', () => {
    const createdAt = localIsoAt(2026, 4, 26); // May 26 local
    expect(isHabitVisibleOnDate(createdAt, '2026-05-25')).toBe(false);
    expect(isHabitVisibleOnDate(createdAt, '2026-05-01')).toBe(false);
    expect(isHabitVisibleOnDate(createdAt, '2025-12-31')).toBe(false);
  });

  it('uses local-tz day for the threshold (not UTC day)', () => {
    // A habit created at noon local time on May 26 must be visible on
    // local May 26, regardless of what UTC date that maps to. Picking
    // noon local makes the test stable across all timezones.
    const createdAt = localIsoAt(2026, 4, 26, 12);
    expect(isHabitVisibleOnDate(createdAt, '2026-05-26')).toBe(true);
    expect(isHabitVisibleOnDate(createdAt, '2026-05-25')).toBe(false);
  });

  it('handles month and year boundaries', () => {
    const createdJan1 = localIsoAt(2026, 0, 1);
    expect(isHabitVisibleOnDate(createdJan1, '2025-12-31')).toBe(false);
    expect(isHabitVisibleOnDate(createdJan1, '2026-01-01')).toBe(true);

    const createdFeb1 = localIsoAt(2026, 1, 1);
    expect(isHabitVisibleOnDate(createdFeb1, '2026-01-31')).toBe(false);
    expect(isHabitVisibleOnDate(createdFeb1, '2026-02-01')).toBe(true);
  });

  it('fails open on malformed createdAt (never hides real data)', () => {
    expect(isHabitVisibleOnDate('not-a-date', '2026-05-01')).toBe(true);
    expect(isHabitVisibleOnDate('', '2026-05-01')).toBe(true);
  });
});
