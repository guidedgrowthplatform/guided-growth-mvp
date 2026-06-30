import { type ReactNode, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CoachChatOverlay, CoachSubtitleBar } from '@/components/coach';
import { OpenChatButton } from '@/components/home';
import { CheckinFlowOverlay } from '@/components/home/CheckinFlowOverlay';
import { ToastContainer } from '@/components/ui/Toast';
import {
  checkinFlowForScreen,
  CoachChatProvider,
  useCoachChatLauncher,
} from '@/contexts/CoachChatContext';
import { CoachVoiceProvider } from '@/contexts/CoachVoiceProvider';
import { useCheckinEntry, useOpenCheckinCoach } from '@/hooks/useCheckinEntry';
import type { CoachChatCloseInfo } from '@/lib/chat/coachChatTypes';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  // CoachChatProvider owns open/close state + target screenId.
  // CoachVoiceProvider sits inside it and owns the lifted chat session +
  // Soniox stream so closing the overlay does not tear them down.
  // Both run only on app routes (Layout isn't used by onboarding).
  return (
    <CoachChatProvider>
      <CoachVoiceProvider>
        <LayoutInner>{children}</LayoutInner>
      </CoachVoiceProvider>
    </CoachChatProvider>
  );
}

function LayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openScreenId, closeCoachChat, openCoachChat } = useCoachChatLauncher();
  const { doneToday } = useCheckinEntry();

  // QA one-shot: the QA Control screen sets this flag (after granting the mic) to
  // drop straight into a specific check-in. Consume it once and force that flow
  // open, regardless of time of day.
  useEffect(() => {
    const qa = sessionStorage.getItem('qa_open_checkin');
    if (qa === 'MCHECK-01' || qa === 'ECHECK-01') {
      sessionStorage.removeItem('qa_open_checkin');
      openCoachChat(qa, { initiateCheckin: true });
    }
  }, [openCoachChat]);
  const checkinFlowId = checkinFlowForScreen(openScreenId);
  // Dedicated check-in screens render the beat engine; HOME-CHECKIN stays LLM chat.
  const chatOpen = openScreenId === 'HOME-CHECKIN';
  const anyOverlayOpen = openScreenId !== null;
  // Opening the coach from the global button leads today's check-in if it isn't
  // done yet (morning→MCHECK-01, evening→ECHECK-01), else opens plain chat.
  const openCheckinCoach = useOpenCheckinCoach();
  const isFullWidth =
    location.pathname === '/add-habit' ||
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

      <BottomNav />
      {!anyOverlayOpen && (
        <>
          <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-6 z-20">
            <OpenChatButton onPress={openCheckinCoach} />
          </div>
          <CoachSubtitleBar />
        </>
      )}
      <ToastContainer />
      {chatOpen && <CoachChatOverlay onClose={handleCloseChat} />}
      {checkinFlowId && (
        <CheckinFlowOverlay
          flowId={checkinFlowId}
          alreadyDone={doneToday}
          onClose={closeCoachChat}
        />
      )}
    </div>
  );
}
