// The default ritual cadence is the user's local work week. JavaScript day
// numbers are 0=Sunday through 6=Saturday.
const ISRAEL_WORKDAYS = [0, 1, 2, 3, 4] as const;
const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5] as const;

function activeLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

function regionFromLocale(locale: string): string | null {
  try {
    return new Intl.Locale(locale).region ?? null;
  } catch {
    // Keep the fallback useful in runtimes without Intl.Locale support.
    return locale.match(/[-_]([A-Za-z]{2}|\d{3})(?:$|[-_])/)?.[1]?.toUpperCase() ?? null;
  }
}

/**
 * The three rituals default to the user's local work week, with weekends off.
 * Israel uses Sunday through Thursday; every other region uses Monday through
 * Friday. An explicit locale keeps previews and tests deterministic.
 */
export function ritualWeekdaysForLocale(locale = activeLocale()): Set<number> {
  return new Set(regionFromLocale(locale) === 'IL' ? ISRAEL_WORKDAYS : DEFAULT_WORKDAYS);
}
