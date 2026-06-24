export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

// Cutoffs match HabitsSection.tsx: morning <12, afternoon <17, evening <21, else night.
export function bucketFromHour(hour: number): TimeOfDay {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// tz-local hour via Intl; invalid/missing tz throws RangeError → caller falls back.
export function localHour(date: Date, timeZone: string): number {
  const hh = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return parseInt(hh, 10) % 24;
}

export function bucketTimeOfDay(date: Date, timeZone: string): TimeOfDay {
  return bucketFromHour(localHour(date, timeZone));
}

// Check-in day boundaries (single source for both the proactive window and the
// binary type). Morning 05:00–15:59; evening 17:00–04:59, wrapping past midnight
// so a 2am open is evening, not morning. 16:00–16:59 is the proactive buffer.
export const MORNING_FROM_HOUR = 5;
export const MORNING_UNTIL_HOUR = 16;
export const EVENING_FROM_HOUR = 17;

// Binary type — the buffer hour resolves to evening (morning window has closed).
export function checkinTypeFromHour(hour: number): 'morning' | 'evening' {
  return hour >= MORNING_FROM_HOUR && hour < MORNING_UNTIL_HOUR ? 'morning' : 'evening';
}
