import { useCallback } from 'react';
import { type CheckinScreenId, useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useReflectionDoneToday } from '@/hooks/useReflectionDoneToday';
import { useSessionLog } from '@/hooks/useSessionLog';
import { formatDate } from '@/utils/dates';
import { localHour, MORNING_FROM_HOUR } from '@gg/shared/time/bucketTimeOfDay';
import { useCheckinDoneToday, useCheckinInitiatedToday } from './useCheckinDoneToday';

export type DedicatedCheckinScreenId = Extract<CheckinScreenId, 'MCHECK-01' | 'ECHECK-01'>;

// Check-in windows by LOCAL hour. Morning 05:00–15:59 (runs late so a missed
// morning isn't lost at noon); evening 17:00–04:59, wrapping past midnight so a
// 2am open is evening, not morning (#207). 16:00-16:59 is a deliberate buffer.
const MORNING_BEFORE_HOUR = 16; // morning offered while hour < 16:00 (4 PM)
const EVENING_FROM_HOUR = 17; // evening offered while hour >= 17:00 (5 PM)

export interface CheckinWindow {
  isMorning: boolean;
  isEvening: boolean;
  proactiveWindow: boolean;
}

// Pure so the 4 PM / 5 PM boundaries are unit-testable without faking the clock.
export function resolveCheckinWindow(hour: number): CheckinWindow {
  const isMorning = hour >= MORNING_FROM_HOUR && hour < MORNING_BEFORE_HOUR;
  const isEvening = hour >= EVENING_FROM_HOUR || hour < MORNING_FROM_HOUR;
  return { isMorning, isEvening, proactiveWindow: isMorning || isEvening };
}

export interface CheckinEntry {
  isMorning: boolean;
  type: 'morning' | 'evening';
  /** The dedicated check-in screen for the current time of day. */
  checkinScreenId: DedicatedCheckinScreenId;
  doneToday: boolean;
  /** The opener already fired today (started but maybe unfinished). */
  initiatedToday: boolean;
  /**
   * Inside a window where a check-in should be proactively offered: morning
   * (<16:00) or evening (>=17:00). The 16:00-16:59 hour is a buffer — neither
   * opener fires there.
   */
  proactiveWindow: boolean;
}

// Pure routing for opening the coach from a GENERAL entry point (the open-chat
// button or the home card). Mirrors HOME-MORNING/HOME-EVENING spec ("route to
// the check-in if not done, else CHAT"). Kept pure so it's unit-testable.
// - done today → plain chat, no proactive opener.
// - started but not done → dedicated screen so check-in tools/flow stay live,
//   but NO opener: reopening must resume the existing thread, never re-ask.
// - fresh → dedicated screen + fire the opener once.
export function resolveCoachOpen(entry: CheckinEntry): {
  screenId: CheckinScreenId;
  initiateCheckin: boolean;
} {
  if (entry.doneToday) return { screenId: 'HOME-CHECKIN', initiateCheckin: false };
  // Afternoon dead zone (12:00-16:59) → plain chat, never proactively ask.
  if (!entry.proactiveWindow) return { screenId: 'HOME-CHECKIN', initiateCheckin: false };
  if (entry.initiatedToday) return { screenId: entry.checkinScreenId, initiateCheckin: false };
  return { screenId: entry.checkinScreenId, initiateCheckin: true };
}

// Shared time-of-day + done-today routing so the home check-in card and the
// global open-chat button can't drift on which check-in to open. 'morning'
// bucket only (<12 local) → morning; afternoon/evening/night → evening.
export function useCheckinEntry(): CheckinEntry {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { isMorning, proactiveWindow } = resolveCheckinWindow(localHour(new Date(), tz));
  const type: 'morning' | 'evening' = isMorning ? 'morning' : 'evening';
  const checkinScreenId: DedicatedCheckinScreenId = isMorning ? 'MCHECK-01' : 'ECHECK-01';

  // Path-independent "done" signal: the persisted daily_checkins row. Every
  // morning-completion path (home card, voice record_checkin, chat
  // record_checkin) writes it, so reading the DATA — not a fragile per-path
  // session-log event — is what guarantees "done" no matter how the user
  // checked in. The session-log event stays as an OR for instant optimism
  // before the query refetches.
  const { checkIn } = useCheckIn(formatDate(new Date()));
  const hasCheckinData =
    !!checkIn &&
    (checkIn.sleep != null ||
      checkIn.mood != null ||
      checkIn.energy != null ||
      checkIn.stress != null);

  // Evening's data signal is a reflection entry today (not the 4-scale row).
  // Same path-independent guarantee as morning so the evening never re-asks
  // after it's finished, even if the checkin_completed event didn't stick.
  const hasReflectionToday = useReflectionDoneToday(type === 'evening');

  const eventDone = useCheckinDoneToday(type);
  // Morning done = the 4-scale row exists; evening done = a reflection logged.
  const doneToday =
    eventDone || (isMorning && hasCheckinData) || (!isMorning && hasReflectionToday);
  const initiatedToday = useCheckinInitiatedToday(type);
  return { isMorning, type, checkinScreenId, doneToday, initiatedToday, proactiveWindow };
}

// Single open-action for both the home card and the global button. Logging the
// `checkin_started` event here (only when actually initiating) is what makes the
// opener fire at most once per bucket per day — the next open reads it back as
// initiatedToday and resumes the thread silently instead of re-asking.
export function useOpenCheckinCoach(): () => void {
  const entry = useCheckinEntry();
  const { openCoachChat } = useCoachChatLauncher();
  const { logEvent } = useSessionLog();
  return useCallback(() => {
    const { screenId, initiateCheckin } = resolveCoachOpen(entry);
    if (initiateCheckin) logEvent('checkin_started', { type: entry.type }, screenId);
    openCoachChat(screenId, { initiateCheckin });
  }, [entry, openCoachChat, logEvent]);
}
