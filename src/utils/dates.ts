import {
  format,
  parseISO,
  getDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { checkinTypeFromHour, localHour } from '@gg/shared/time/bucketTimeOfDay';

// tz-aware morning/evening for the current moment (2am → evening, #207).
export function currentCheckinType(): 'morning' | 'evening' {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return checkinTypeFromHour(localHour(new Date(), tz));
}

export function formatDate(date: Date | string, fmt = 'yyyy-MM-dd'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function getMonthDays(date: Date | string): Date[] {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) });
}

export function isWeekend(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const day = getDay(d);
  return day === 0 || day === 6;
}

export function isWeekday(date: Date | string): boolean {
  return !isWeekend(date);
}

export function getWeekRange(date: Date | string): { start: Date; end: Date } {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return {
    start: startOfWeek(d, { weekStartsOn: 1 }),
    end: endOfWeek(d, { weekStartsOn: 1 }),
  };
}

export function getWeekDays(date: Date | string): Date[] {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const { start, end } = getWeekRange(d);
  return eachDayOfInterval({ start, end });
}
