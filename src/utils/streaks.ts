import { format, subDays } from 'date-fns';
import type { Metric, EntriesMap } from '@shared/types';

export interface StreakResult {
  current: number;
  longest: number;
}

export function computeStreak(entries: EntriesMap, metricId: string, metric: Metric): StreakResult {
  const today = new Date();
  let current = 0;
  let longest = 0;
  let streak = 0;
  let foundGap = false;

  // Walk backwards from today up to 365 days
  for (let i = 0; i < 365; i++) {
    const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
    const value = entries[dateStr]?.[metricId];
    const hasValue = isCompleted(value, metric);

    if (hasValue) {
      streak++;
      if (!foundGap) current = streak;
      longest = Math.max(longest, streak);
    } else {
      if (!foundGap && i === 0) {
        // Today might not be tracked yet; skip it
        continue;
      }
      foundGap = true;
      streak = 0;
    }
  }

  return { current, longest };
}

function isCompleted(value: string | undefined, metric: Metric): boolean {
  if (!value || value === '') return false;
  if (metric.input_type === 'binary') return value === 'yes';
  if (metric.input_type === 'numeric') return parseFloat(value) > 0;
  return value.trim().length > 0;
}
