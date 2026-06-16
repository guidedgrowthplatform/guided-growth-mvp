import { useSessionLogStore, type SessionLogEvent } from '@/stores/sessionLogStore';
import { formatDate } from '@/utils/dates';

// Evening "done today" = a checkin_completed event with payload.type==='evening'
// whose UTC timestamp falls on the user's LOCAL day (timestamps are stamped via
// new Date().toISOString()).
export function isEveningDoneToday(events: SessionLogEvent[], now: Date = new Date()): boolean {
  const today = formatDate(now);
  return events.some(
    (e) =>
      e.event_type === 'checkin_completed' &&
      (e.payload as { type?: unknown } | null)?.type === 'evening' &&
      formatDate(new Date(e.timestamp)) === today,
  );
}

// morningDone is derived caller-side from useCheckIn (checkIn !== null), since the
// daily_checkins row is the authoritative morning signal.
export function useCheckinDoneToday(bucket: 'morning' | 'evening', morningDone: boolean): boolean {
  const events = useSessionLogStore((s) => s.events);
  if (bucket === 'morning') return morningDone;
  return isEveningDoneToday(events);
}
