import { type ReactNode, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CoachChatOverlay } from '@/components/coach';
import { OpenChatButton } from '@/components/home';
import { ToastContainer } from '@/components/ui/Toast';
import { CoachChatProvider, useCoachChatLauncher } from '@/contexts/CoachChatContext';
import type { CoachChatCloseInfo } from '@/lib/chat/coachChatTypes';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <CoachChatProvider>
      <LayoutInner>{children}</LayoutInner>
    </CoachChatProvider>
  );
}

function LayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openScreenId, openCoachChat, closeCoachChat } = useCoachChatLauncher();
  const chatOpen = openScreenId !== null;
  const isFullWidth =
    location.pathname === '/report' ||
    location.pathname === '/focus' ||
    location.pathname === '/journal' ||
    location.pathname.startsWith('/reflections');

  const handleCloseChat = useCallback(
    (info?: CoachChatCloseInfo) => {
      closeCoachChat();
      const created = info?.lastCreatedItem;
      if (!created) return;
      if (created.type === 'habit') {
        navigate(`/habit/${created.id}`);
      } else if (created.type === 'reflection') {
        navigate(`/reflections/${created.id}`);
      }
    },
    [navigate, closeCoachChat],
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

      <BottomNav hidden={chatOpen} />
      {!chatOpen && (
        <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-6 z-20">
          <OpenChatButton onPress={() => openCoachChat('HOME-CHECKIN')} />
        </div>
      )}
      <ToastContainer />
      {chatOpen && <CoachChatOverlay screenId={openScreenId} onClose={handleCloseChat} />}
    </div>
  );
}
