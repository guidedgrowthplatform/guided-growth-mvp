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
