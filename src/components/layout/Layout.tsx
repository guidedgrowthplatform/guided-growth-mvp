import { type ReactNode, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CoachChatOverlay } from '@/components/coach';
import { OpenChatButton } from '@/components/home';
import { ToastContainer } from '@/components/ui/Toast';
import type { CoachChatCloseInfo } from '@/lib/chat/coachChatTypes';
import { unlockTTS } from '@/lib/services/tts-service';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  const [showCoachChat, setShowCoachChat] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isFullWidth =
    location.pathname === '/report' ||
    location.pathname === '/focus' ||
    location.pathname === '/journal' ||
    location.pathname.startsWith('/reflections');

  const handleOpenChat = useCallback(() => {
    unlockTTS();
    setShowCoachChat(true);
  }, []);

  const handleCloseChat = useCallback(
    (info?: CoachChatCloseInfo) => {
      setShowCoachChat(false);
      const created = info?.lastCreatedItem;
      if (!created) return;
      if (created.type === 'habit') {
        navigate(`/habit/${created.id}`);
      } else if (created.type === 'reflection') {
        navigate(`/reflections/${created.id}`);
      }
    },
    [navigate],
  );

  return (
    <div className="flex min-h-dvh">
      <main className="min-w-0 flex-1">
        {isFullWidth ? (
          children
        ) : (
          <div className="px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
            {children}
          </div>
        )}
      </main>

      <BottomNav hidden={showCoachChat} />
      {!showCoachChat && (
        <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-6 z-20">
          <OpenChatButton onPress={handleOpenChat} />
        </div>
      )}
      <ToastContainer />
      {showCoachChat && <CoachChatOverlay screenId="HOME-CHECKIN" onClose={handleCloseChat} />}
    </div>
  );
}
