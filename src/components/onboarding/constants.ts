import type { ScheduleOption } from './SchedulePicker';

/** Shared style for uppercase section labels in onboarding cards */
export const SECTION_LABEL_CLASS =
  'text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-tertiary';

/** Day index constants (0 = Sunday, 6 = Saturday) */
const DAYS = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

export const WEEKDAYS = new Set([
  DAYS.MONDAY,
  DAYS.TUESDAY,
  DAYS.WEDNESDAY,
  DAYS.THURSDAY,
  DAYS.FRIDAY,
]);
export const WEEKEND = new Set([DAYS.SUNDAY, DAYS.SATURDAY]);
export const ALL_DAYS = new Set([
  DAYS.SUNDAY,
  DAYS.MONDAY,
  DAYS.TUESDAY,
  DAYS.WEDNESDAY,
  DAYS.THURSDAY,
  DAYS.FRIDAY,
  DAYS.SATURDAY,
]);

/** Day-of-week sets per SchedulePicker preset. Mirror of the same map in
 * api/_lib/llm/tools.onboarding.ts so frontend and backend write identical
 * shapes. */
export const SCHEDULE_DAYS: Record<ScheduleOption, Set<number>> = {
  Weekday: WEEKDAYS,
  Weekend: WEEKEND,
  'Every day': ALL_DAYS,
};

/** Toggle an item in a Set, returning a new Set */
export function toggleSetItem<T>(prev: Set<T>, item: T): Set<T> {
  const next = new Set(prev);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

/** Check if two Sets contain the same items */
export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

/** Format a Set of day indices into a human-readable cadence string */
export function formatCadence(days: Set<number>): string {
  if (days.size === 7) return 'Daily';
  if (setsEqual(days, WEEKDAYS)) return 'Weekdays';
  if (setsEqual(days, WEEKEND)) return 'Weekends';
  return `${days.size} days/week`;
}

/**
 * Infer the matching SchedulePicker preset for a given day set, or null if
 * the set doesn't match any preset (custom day combinations).
 *
 * Used by HabitCustomizeSheet + Step6Page to keep `schedule` and `days` in
 * sync: toggling a day re-derives the chip label, so the persisted
 * {days, schedule} pair always agrees. PlanReviewPage then reads
 * formatCadence(days) alone and gets a faithful label without consulting
 * schedule.
 */
export function inferSchedule(days: Set<number>): ScheduleOption | null {
  for (const [label, preset] of Object.entries(SCHEDULE_DAYS)) {
    if (setsEqual(days, preset)) return label as ScheduleOption;
  }
  return null;
}
