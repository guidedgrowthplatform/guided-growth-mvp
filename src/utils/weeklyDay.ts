// The Weekly's recommended day, by region. The session plans the week ahead, so
// we recommend the evening before the user's work week starts. Most regions start
// the work week on Monday, so the recommendation is Sunday night (day 0).
// Sunday-start regions like Israel begin the work week on Sunday, so the evening
// before is Saturday night (day 6, motzash / motzaei Shabbat).
//
// Keyed on the device timezone (permission-free, language-independent). The card
// preselects this day; the coach recommends it out loud, phrased natively per the
// language it is speaking (see the ONBOARD-WEEKLY-SETUP beat context).

// Day-of-week ints: 0=Sunday .. 6=Saturday, matching WEEKLY_DAY_OPTIONS and
// reflection_settings.weekly_day.
const SUNDAY = 0;
const SATURDAY = 6;

// Timezones whose work week starts on Sunday (so The Weekly is recommended for
// Saturday night). Kept tight and explicit: Israel is the confident member.
// Extend only with zones confirmed to run a Sunday-start work week.
const SUNDAY_START_ZONES = new Set<string>(['Asia/Jerusalem']);

export function recommendedWeeklyDay(
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): number {
  return SUNDAY_START_ZONES.has(timeZone) ? SATURDAY : SUNDAY;
}
