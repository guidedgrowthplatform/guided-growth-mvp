import { type ReactNode, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { VoiceCheckInOverlay } from '@/components/home/VoiceCheckInOverlay';
import { ToastContainer } from '@/components/ui/Toast';
import { unlockTTS } from '@/lib/services/tts-service';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  const [showVoiceCheckIn, setShowVoiceCheckIn] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/home';
  const isFullWidth = location.pathname === '/report' || location.pathname === '/focus';

  const handleVoicePress = useCallback(() => {
    unlockTTS();
    setShowVoiceCheckIn(true);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <main className="flex-1">
        {isFullWidth ? (
          children
        ) : (
          <div
            className={`mx-auto max-w-sm px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-6 lg:pt-6 ${isHomePage ? 'pt-4' : 'pt-6'}`}
          >
            {children}
          </div>
        )}
      </main>

      <BottomNav onVoicePress={handleVoicePress} />
      <ToastContainer />
      {showVoiceCheckIn && <VoiceCheckInOverlay onClose={() => setShowVoiceCheckIn(false)} />}
    </div>
  );
}
