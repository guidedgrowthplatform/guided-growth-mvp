import { useCallback } from 'react';
import { isCheckinRequest } from '@/components/home/detectCheckinRequest';
import { useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { useCoachVoice } from '@/contexts/useCoachVoiceSession';
import { resolveCoachOpen, useCheckinEntry } from '@/hooks/useCheckinEntry';
import { useDisplayName } from '@/hooks/useDisplayName';
import { useSessionLog } from '@/hooks/useSessionLog';
import type { CoachChatCloseInfo } from '@/lib/chat/coachChatTypes';
import { CoachChatView } from './CoachChatView';

interface Props {
  onClose: (info?: CoachChatCloseInfo) => void;
}

// Pure view of the coach chat — session lives in CoachVoiceProvider so
// closing this overlay does not tear the chat down.
export function CoachChatOverlay({ onClose }: Props) {
  const displayName = useDisplayName();
  const api = useCoachVoice();
  const { openCoachChat } = useCoachChatLauncher();
  const { logEvent } = useSessionLog();
  const entry = useCheckinEntry();
  const lastCreatedItem = api?.lastCreatedItem;
  const handleClose = useCallback(() => {
    onClose(lastCreatedItem ? { lastCreatedItem } : undefined);
  }, [onClose, lastCreatedItem]);

  // A typed "do my check-in" routes into the scripted beat flow (MCHECK-01/
  // ECHECK-01) instead of the LLM half-running it here. Falls through to chat
  // when already done / outside a check-in window.
  const sendText = useCallback(
    (text: string) => {
      if (isCheckinRequest(text)) {
        const { screenId, initiateCheckin } = resolveCoachOpen(entry);
        if (screenId !== 'HOME-CHECKIN') {
          if (initiateCheckin) logEvent('checkin_started', { type: entry.type }, screenId);
          openCoachChat(screenId, { initiateCheckin });
          return;
        }
      }
      api?.sendText(text);
    },
    [api, entry, openCoachChat, logEvent],
  );

  if (!api) return null;
  return (
    <CoachChatView {...api} sendText={sendText} displayName={displayName} onClose={handleClose} />
  );
}
