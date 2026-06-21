import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type CheckinScreenId, useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { isCheckinDoneToday, isCheckinInitiatedToday } from '@/hooks/useCheckinDoneToday';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { type SessionLogEvent, useSessionLogStore } from '@/stores/sessionLogStore';

export type ReminderBucket = 'morning' | 'evening';

export function resolveReminderCoachOpen(
  bucket: ReminderBucket,
  events: SessionLogEvent[],
): { screenId: CheckinScreenId; initiateCheckin: boolean } {
  const screenId: CheckinScreenId = bucket === 'morning' ? 'MCHECK-01' : 'ECHECK-01';
  if (isCheckinDoneToday(events, bucket))
    return { screenId: 'HOME-CHECKIN', initiateCheckin: false };
  if (isCheckinInitiatedToday(events, bucket)) return { screenId, initiateCheckin: false };
  return { screenId, initiateCheckin: true };
}

export function useReminderCheckinDeepLink(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useUserPreferences();
  const { logEvent } = useSessionLog();
  const { openCoachChat } = useCoachChatLauncher();
  const micAllowed = preferences.micPermission === true;
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const bucket = new URLSearchParams(location.search).get('checkin');
    if (bucket !== 'morning' && bucket !== 'evening') {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === bucket) return;
    handledRef.current = bucket;

    void updatePreferences({ voiceMode: 'voice', micEnabled: micAllowed });
    const { screenId, initiateCheckin } = resolveReminderCoachOpen(
      bucket,
      useSessionLogStore.getState().events,
    );
    if (initiateCheckin) logEvent('checkin_started', { type: bucket }, screenId);
    openCoachChat(screenId, { initiateCheckin });

    navigate(location.pathname, { replace: true, state: location.state });
  }, [
    location.search,
    location.pathname,
    location.state,
    navigate,
    openCoachChat,
    updatePreferences,
    micAllowed,
    logEvent,
  ]);
}
