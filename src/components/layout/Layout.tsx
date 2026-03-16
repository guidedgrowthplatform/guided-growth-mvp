import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer } from '@/components/ui/Toast';
import { VoiceTranscript } from '@/components/voice/VoiceTranscript';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/home';

  return (
    <div className="flex min-h-screen">
      {!isHomePage && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed left-4 top-4 z-50 rounded-lg border border-border bg-surface p-3 shadow-elevated transition-all hover:bg-surface-secondary lg:hidden"
          aria-label="Toggle menu"
        >
          <div className="flex h-5 w-5 flex-col justify-center gap-1">
            <span
              className={`block h-0.5 w-full bg-content transition-all ${sidebarOpen ? 'translate-y-1.5 rotate-45' : ''}`}
            />
            <span
              className={`block h-0.5 w-full bg-content transition-all ${sidebarOpen ? 'opacity-0' : ''}`}
            />
            <span
              className={`block h-0.5 w-full bg-content transition-all ${sidebarOpen ? '-translate-y-1.5 -rotate-45' : ''}`}
            />
          </div>
        </button>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-60">
        <div
          className={`mx-auto max-w-5xl px-4 pb-32 lg:pb-6 lg:pt-6 ${isHomePage ? 'pt-4' : 'pt-16'}`}
        >
          {children}
        </div>
      </main>

      <BottomNav />
      <ToastContainer />
      <VoiceTranscript />
    </div>
  );
}
