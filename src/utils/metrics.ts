import { parseISO, getDay, format } from 'date-fns';
import type { Metric, Frequency, EntriesMap } from '@shared/types';
import { getWeekRange } from './dates';

export function isMetricDue(
  metric: Pick<Metric, 'frequency'>,
  dateStr: string,
  entries?: EntriesMap,
): boolean {
  const date = parseISO(dateStr);
  const dayOfWeek = getDay(date);

  switch (metric.frequency as Frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'weekly': {
      if (dayOfWeek === 1) return true; // Monday
      if (!entries) return true;
      const { start, end } = getWeekRange(date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = format(d, 'yyyy-MM-dd');
        if (entries[key]?.[(metric as Metric).id]) return false;
      }
      return true;
    }
    default:
      return true;
  }
}
