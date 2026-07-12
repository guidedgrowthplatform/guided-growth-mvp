// RFC-5545 RRULE strings from the repo's schedule_days convention (0=Sun..6=Sat,
// null/[] = daily). Mirrors isScheduledToday (checkin/handlers/queryHabits.ts).

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

function normalizeDays(scheduleDays: number[] | null | undefined): number[] {
  if (!scheduleDays) return [];
  return Array.from(
    new Set(scheduleDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ).sort((a, b) => a - b);
}

// null/empty or all-7 ⇒ daily; else a weekly subset.
export function buildRrule(scheduleDays: number[] | null | undefined): string {
  const days = normalizeDays(scheduleDays);
  if (days.length === 0 || days.length === 7) return 'RRULE:FREQ=DAILY';
  return `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`;
}

// The Weekly: single fixed day; out-of-range defaults to Sunday (DEFAULT_WEEKLY_DAY).
export function buildWeeklyRrule(weeklyDay: number): string {
  const d = Number.isInteger(weeklyDay) && weeklyDay >= 0 && weeklyDay <= 6 ? weeklyDay : 0;
  return `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d]}`;
}
