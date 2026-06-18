import { useCallback } from 'react';
import { useCoachVoice } from '@/contexts/useCoachVoiceSession';
import { useCheckinFlow } from '@/hooks/useCheckinFlow';
import { useDisplayName } from '@/hooks/useDisplayName';
import type { CoachChatCloseInfo } from '@/lib/chat/coachChatTypes';
import { CoachChatView } from './CoachChatView';
import { ScriptedCheckinView } from './ScriptedCheckinView';

interface Props {
  onClose: (info?: CoachChatCloseInfo) => void;
}

// Pure view of the coach chat — session lives in CoachVoiceProvider so
// closing this overlay does not tear the chat down.
export function CoachChatOverlay({ onClose }: Props) {
  const displayName = useDisplayName();
  const api = useCoachVoice();
  const lastCreatedItem = api?.lastCreatedItem;

  // Scripted check-in (flag-gated). resolveCoachOpen only lands on MCHECK/ECHECK
  // when the check-in is NOT done, so the screen-derived mode is enough. Hook
  // runs unconditionally (rules of hooks); flow.active folds in the flag.
  const screenId = api?.currentScreenId ?? '';
  const mode = screenId.startsWith('MCHECK')
    ? 'morning'
    : screenId.startsWith('ECHECK')
      ? 'evening'
      : null;
  const flow = useCheckinFlow({ mode, enabled: mode != null });

  const handleClose = useCallback(() => {
    onClose(lastCreatedItem ? { lastCreatedItem } : undefined);
  }, [onClose, lastCreatedItem]);

  if (!api) return null;
  if (flow.active) {
    return <ScriptedCheckinView flow={flow} displayName={displayName} onClose={handleClose} />;
  }
  return <CoachChatView {...api} displayName={displayName} onClose={handleClose} />;
}
