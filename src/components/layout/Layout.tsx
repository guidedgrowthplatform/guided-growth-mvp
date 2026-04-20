import { type ReactNode, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { OpenChatButton, VoiceCheckInOverlay } from '@/components/home';
import { ToastContainer } from '@/components/ui/Toast';
import { unlockTTS } from '@/lib/services/tts-service';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  const [showVoiceCheckIn, setShowVoiceCheckIn] = useState(false);
  const location = useLocation();
  const isFullWidth = location.pathname === '/report' || location.pathname === '/focus';

  const handleVoicePress = useCallback(() => {
    unlockTTS();
    setShowVoiceCheckIn(true);
  }, []);

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
      {!showVoiceCheckIn && (
        <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-6 z-20">
          <OpenChatButton onPress={handleVoicePress} />
        </div>
      )}
      <ToastContainer />
      {showVoiceCheckIn && <VoiceCheckInOverlay onClose={() => setShowVoiceCheckIn(false)} />}
    </div>
  );
}
