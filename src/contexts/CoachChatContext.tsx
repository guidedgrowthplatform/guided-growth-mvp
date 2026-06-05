import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { unlockTTS } from '@/lib/services/tts-service';

interface CoachChatContextValue {
  openScreenId: string | null;
  openCoachChat: (screenId: string) => void;
  closeCoachChat: () => void;
}

const CoachChatContext = createContext<CoachChatContextValue | null>(null);

export function CoachChatProvider({ children }: { children: ReactNode }) {
  const [openScreenId, setOpenScreenId] = useState<string | null>(null);

  const openCoachChat = useCallback((screenId: string) => {
    unlockTTS();
    setOpenScreenId(screenId);
  }, []);

  const closeCoachChat = useCallback(() => setOpenScreenId(null), []);

  const value = useMemo(
    () => ({ openScreenId, openCoachChat, closeCoachChat }),
    [openScreenId, openCoachChat, closeCoachChat],
  );

  return <CoachChatContext.Provider value={value}>{children}</CoachChatContext.Provider>;
}

export function useCoachChatLauncher(): CoachChatContextValue {
  const ctx = useContext(CoachChatContext);
  if (!ctx) throw new Error('useCoachChatLauncher must be used within CoachChatProvider');
  return ctx;
}
