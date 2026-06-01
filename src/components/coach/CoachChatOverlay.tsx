import { useCoachChat } from '@/hooks/useCoachChat';
import { useDisplayName } from '@/hooks/useDisplayName';
import { CoachChatView } from './CoachChatView';

interface Props {
  screenId: string;
  onClose: () => void;
}

// Reusable coach conversation overlay — mount on any post-onboarding screen.
export function CoachChatOverlay({ screenId, onClose }: Props) {
  const displayName = useDisplayName();
  const api = useCoachChat(screenId);
  return <CoachChatView {...api} displayName={displayName} onClose={onClose} />;
}
