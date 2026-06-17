import { useSessionLogStore, type SessionLogEvent } from '@/stores/sessionLogStore';
import { formatDate } from '@/utils/dates';

// "<bucket> done today" = a checkin_completed event with payload.type===bucket
// whose timestamp falls on the user's LOCAL day. daily_checkins is one row per
// date (shared morning/evening), so row-existence can't discriminate — the typed
// event is the authoritative per-bucket signal (MR#2). Emitted by the tap path
// (useCheckIn) and the voice path (useCoachChatToolEvents) with the right type.
export function isCheckinDoneToday(
  events: SessionLogEvent[],
  bucket: 'morning' | 'evening',
  now: Date = new Date(),
): boolean {
  const today = formatDate(now);
  return events.some(
    (e) =>
      e.event_type === 'checkin_completed' &&
      (e.payload as { type?: unknown } | null)?.type === bucket &&
      formatDate(new Date(e.timestamp)) === today,
  );
}

export function useCheckinDoneToday(bucket: 'morning' | 'evening'): boolean {
  const events = useSessionLogStore((s) => s.events);
  return isCheckinDoneToday(events, bucket);
}
