import type { CheckinScreenId } from '@/contexts/CoachChatContext';
import { bucketTimeOfDay } from '@gg/shared/time/bucketTimeOfDay';
import { useCheckinDoneToday } from './useCheckinDoneToday';

export type DedicatedCheckinScreenId = Extract<CheckinScreenId, 'MCHECK-01' | 'ECHECK-01'>;

export interface CheckinEntry {
  isMorning: boolean;
  type: 'morning' | 'evening';
  /** The dedicated check-in screen for the current time of day. */
  checkinScreenId: DedicatedCheckinScreenId;
  doneToday: boolean;
}

// Pure routing for opening the coach from a GENERAL entry point (the open-chat
// button): if today's check-in isn't done, lead into it; otherwise open plain
// chat. Mirrors HOME-MORNING/HOME-EVENING spec ("route to the check-in if not
// done, else CHAT"). Kept pure so it's unit-testable without React.
export function resolveCoachOpen(entry: CheckinEntry): {
  screenId: CheckinScreenId;
  initiateCheckin: boolean;
} {
  if (entry.doneToday) return { screenId: 'HOME-CHECKIN', initiateCheckin: false };
  return { screenId: entry.checkinScreenId, initiateCheckin: true };
}

// Shared time-of-day + done-today routing so the home check-in card and the
// global open-chat button can't drift on which check-in to open. 'morning'
// bucket only (<12 local) → morning; afternoon/evening/night → evening.
export function useCheckinEntry(): CheckinEntry {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isMorning = bucketTimeOfDay(new Date(), tz) === 'morning';
  const type: 'morning' | 'evening' = isMorning ? 'morning' : 'evening';
  const checkinScreenId: DedicatedCheckinScreenId = isMorning ? 'MCHECK-01' : 'ECHECK-01';
  const doneToday = useCheckinDoneToday(type);
  return { isMorning, type, checkinScreenId, doneToday };
}
