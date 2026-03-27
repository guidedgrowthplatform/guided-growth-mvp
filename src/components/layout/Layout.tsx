import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { VoiceCheckInOverlay } from '@/components/home/VoiceCheckInOverlay';
import { ToastContainer } from '@/components/ui/Toast';
import { VoiceTranscript } from '@/components/voice/VoiceTranscript';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  const [showVoiceCheckIn, setShowVoiceCheckIn] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/home';
  const isFullWidth = location.pathname === '/report' || location.pathname === '/focus';

  return (
    <div className="flex min-h-screen">
      <main className="flex-1">
        {isFullWidth ? (
          children
        ) : (
          <div
            className={`mx-auto max-w-sm px-4 pb-32 lg:pb-6 lg:pt-6 ${isHomePage ? 'pt-4' : 'pt-6'}`}
          >
            {children}
          </div>
        )}
      </main>

      <BottomNav onVoicePress={() => setShowVoiceCheckIn(true)} />
      <ToastContainer />
      <VoiceTranscript />
      {showVoiceCheckIn && <VoiceCheckInOverlay onClose={() => setShowVoiceCheckIn(false)} />}
    </div>
  );
}
