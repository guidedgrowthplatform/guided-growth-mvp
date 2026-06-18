import { useSessionLogStore, type SessionLogEvent } from '@/stores/sessionLogStore';
import { formatDate } from '@/utils/dates';

// A per-bucket session-log signal on the user's LOCAL day. daily_checkins is one
// row per date (shared morning/evening), so row-existence can't discriminate —
// the typed event is the authoritative per-bucket signal (MR#2).
function hasCheckinEventToday(
  events: SessionLogEvent[],
  eventType: 'checkin_completed' | 'checkin_started',
  bucket: 'morning' | 'evening',
  now: Date,
): boolean {
  const today = formatDate(now);
  return events.some(
    (e) =>
      e.event_type === eventType &&
      (e.payload as { type?: unknown } | null)?.type === bucket &&
      formatDate(new Date(e.timestamp)) === today,
  );
}

// "<bucket> done today" — emitted by the tap path (useCheckIn) and the voice
// path (useCoachChatToolEvents) when the bucket's concluding tool fires.
export function isCheckinDoneToday(
  events: SessionLogEvent[],
  bucket: 'morning' | 'evening',
  now: Date = new Date(),
): boolean {
  return hasCheckinEventToday(events, 'checkin_completed', bucket, now);
}

// "<bucket> already initiated today" — the opener fired once. Gates re-asking:
// reopening a started-but-unfinished check-in must not re-fire the opener.
export function isCheckinInitiatedToday(
  events: SessionLogEvent[],
  bucket: 'morning' | 'evening',
  now: Date = new Date(),
): boolean {
  return hasCheckinEventToday(events, 'checkin_started', bucket, now);
}

export function useCheckinDoneToday(bucket: 'morning' | 'evening'): boolean {
  const events = useSessionLogStore((s) => s.events);
  return isCheckinDoneToday(events, bucket);
}

export function useCheckinInitiatedToday(bucket: 'morning' | 'evening'): boolean {
  const events = useSessionLogStore((s) => s.events);
  return isCheckinInitiatedToday(events, bucket);
}
