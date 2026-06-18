import { useCallback } from 'react';
import { useCoachVoice } from '@/contexts/useCoachVoiceSession';
import { useDisplayName } from '@/hooks/useDisplayName';
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
  const lastCreatedItem = api?.lastCreatedItem;
  const handleClose = useCallback(() => {
    onClose(lastCreatedItem ? { lastCreatedItem } : undefined);
  }, [onClose, lastCreatedItem]);
  if (!api) return null;
  return <CoachChatView {...api} displayName={displayName} onClose={handleClose} />;
}
