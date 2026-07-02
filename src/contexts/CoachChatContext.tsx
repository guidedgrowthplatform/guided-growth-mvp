import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { unlockCartesiaVoice } from '@/lib/services/cartesiaVoice';
import { unlockTTS } from '@/lib/services/tts-service';

export type CheckinScreenId = 'HOME-CHECKIN' | 'MCHECK-01' | 'ECHECK-01';

interface CoachChatContextValue {
  openScreenId: CheckinScreenId | null;
  // Bumps each open-with-initiateCheckin — the provider/hook watches this to
  // fire a proactive coach opener even when the timeline already has history.
  initiateCheckinNonce: number;
  openCoachChat: (screenId: CheckinScreenId, opts?: { initiateCheckin?: boolean }) => void;
  closeCoachChat: () => void;
}

const CoachChatContext = createContext<CoachChatContextValue | null>(null);

export function CoachChatProvider({ children }: { children: ReactNode }) {
  const [openScreenId, setOpenScreenId] = useState<CheckinScreenId | null>(null);
  const [initiateCheckinNonce, setInitiateCheckinNonce] = useState(0);

  const openCoachChat = useCallback(
    (screenId: CheckinScreenId, opts?: { initiateCheckin?: boolean }) => {
      unlockTTS();
      unlockCartesiaVoice();
      setOpenScreenId(screenId);
      if (opts?.initiateCheckin) setInitiateCheckinNonce((n) => n + 1);
    },
    [],
  );

  const closeCoachChat = useCallback(() => setOpenScreenId(null), []);

  const value = useMemo(
    () => ({ openScreenId, initiateCheckinNonce, openCoachChat, closeCoachChat }),
    [openScreenId, initiateCheckinNonce, openCoachChat, closeCoachChat],
  );

  return <CoachChatContext.Provider value={value}>{children}</CoachChatContext.Provider>;
}

export function useCoachChatLauncher(): CoachChatContextValue {
  const ctx = useContext(CoachChatContext);
  if (!ctx) throw new Error('useCoachChatLauncher must be used within CoachChatProvider');
  return ctx;
}
