import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeStreak } from './streaks';
import type { Metric, EntriesMap } from '@shared/types';
import { format, subDays } from 'date-fns';

const makeMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: 'm1',
  user_id: 'u1',
  name: 'Test',
  input_type: 'binary',
  question: '',
  active: true,
  frequency: 'daily',
  sort_order: 0,
  target_value: null,
  target_unit: null,
  created_at: '',
  updated_at: '',
  ...overrides,
});

function makeDateStr(daysAgo: number): string {
  return format(subDays(new Date(), daysAgo), 'yyyy-MM-dd');
}

describe('computeStreak', () => {
  it('returns 0 for no entries', () => {
    const result = computeStreak({}, 'm1', makeMetric());
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
  });

  it('counts consecutive days', () => {
    const entries: EntriesMap = {
      [makeDateStr(1)]: { m1: 'yes' },
      [makeDateStr(2)]: { m1: 'yes' },
      [makeDateStr(3)]: { m1: 'yes' },
    };
    const result = computeStreak(entries, 'm1', makeMetric());
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it('tracks longest separately from current', () => {
    const entries: EntriesMap = {
      [makeDateStr(1)]: { m1: 'yes' },
      [makeDateStr(2)]: { m1: 'yes' },
      // gap at day 3
      [makeDateStr(4)]: { m1: 'yes' },
      [makeDateStr(5)]: { m1: 'yes' },
      [makeDateStr(6)]: { m1: 'yes' },
      [makeDateStr(7)]: { m1: 'yes' },
    };
    const result = computeStreak(entries, 'm1', makeMetric());
    expect(result.current).toBe(2);
    expect(result.longest).toBe(4);
  });

  it('handles numeric metrics', () => {
    const entries: EntriesMap = {
      [makeDateStr(1)]: { m1: '5' },
      [makeDateStr(2)]: { m1: '3' },
      [makeDateStr(3)]: { m1: '0' }, // zero = not completed
    };
    const result = computeStreak(entries, 'm1', makeMetric({ input_type: 'numeric' }));
    expect(result.current).toBe(2);
  });
});
