import {
  format,
  parseISO,
  getDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
  isSameYear,
} from 'date-fns';

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

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatRelativeDateTime(iso: string, now: Date = new Date()): string {
  const d = parseISO(iso);
  const diff = differenceInCalendarDays(now, d);
  const time = format(d, 'hh:mm a');

  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  if (diff > 1 && diff < 7) return format(d, 'EEEE, MMM d');
  if (isSameYear(d, now)) return format(d, 'MMM d');
  return format(d, 'MMMM d, yyyy');
}
