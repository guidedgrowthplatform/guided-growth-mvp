/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { HabitCompletion } from '@/lib/services/data-service.interface';
import { calcCurrentStreak } from '../useHabitsForDate';

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
    const dates = [
      completion('2026-05-01'),
      completion('2026-05-01'),
      completion('2026-04-30'),
    ];
    expect(calcCurrentStreak(dates, '2026-05-01')).toBe(2);
  });
});
