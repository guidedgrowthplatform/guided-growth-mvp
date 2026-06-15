import { differenceInCalendarDays, differenceInHours, differenceInMinutes, format } from 'date-fns';

export function formatTimeAgo(iso: string): string {
  const now = new Date();
  const parsed = new Date(iso);
  const date = parsed > now ? now : parsed;
  const days = differenceInCalendarDays(now, date);
  if (days === 0) {
    const hours = differenceInHours(now, date);
    if (hours >= 1) return `${hours}h ago`;
    const minutes = Math.max(1, differenceInMinutes(now, date));
    return `${minutes}m ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return format(date, 'MMM d');
}
