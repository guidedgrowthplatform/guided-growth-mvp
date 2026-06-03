import { useCallback } from 'react';
import { useCoachChat } from '@/hooks/useCoachChat';
import { useDisplayName } from '@/hooks/useDisplayName';
import type { CoachChatCloseInfo } from '@/lib/chat/coachChatTypes';
import { CoachChatView } from './CoachChatView';

interface Props {
  screenId: string;
  onClose: (info?: CoachChatCloseInfo) => void;
}

// Reusable coach conversation overlay — mount on any post-onboarding screen.
export function CoachChatOverlay({ screenId, onClose }: Props) {
  const displayName = useDisplayName();
  const api = useCoachChat(screenId);
  const { lastCreatedItem } = api;
  const handleClose = useCallback(() => {
    onClose(lastCreatedItem ? { lastCreatedItem } : undefined);
  }, [onClose, lastCreatedItem]);
  return <CoachChatView {...api} displayName={displayName} onClose={handleClose} />;
}
