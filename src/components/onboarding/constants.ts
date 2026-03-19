/** Shared style for uppercase section labels in onboarding cards */
export const SECTION_LABEL_CLASS =
  'text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-tertiary';

/** Day index constants (0 = Sunday, 6 = Saturday) */
export const DAYS = {
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
