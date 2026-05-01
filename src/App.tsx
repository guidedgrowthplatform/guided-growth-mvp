import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { VoiceProvider } from '@/contexts/VoiceContext';
import { useVoicePreferenceSync } from '@/hooks/useVoicePreferenceSync';
import { queryClient } from '@/lib/query';
import { AppRoutes } from '@/routes';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { deepLinkAuthError } from './main';

// Tanstack Query devtools ship as a tiny badge in the bottom-right corner.
// That badge was visible in the APK v6 production build — on the emulator
// it rendered as a palm-tree-sun icon that users would absolutely tap
// thinking it was part of the UI. Gate behind import.meta.env.DEV so
// the devtools don't even end up in the production bundle (the lazy
// import keeps the dev chunk out of the prod build entirely).
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

function DeepLinkErrorReporter() {
  const { addToast } = useToast();
  useEffect(() => {
    if (deepLinkAuthError) {
      addToast('error', deepLinkAuthError);
    }
  }, [addToast]);
  return null;
}

function VoicePreferenceSync() {
  useVoicePreferenceSync();
  return null;
}

export default function App() {
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  // GLOB-03: any pointerdown/keydown reactivates a system-grayed mic.
  // No-op for active or user-off states.
  useEffect(() => {
    const onInteraction = () => {
      useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    };
    document.addEventListener('pointerdown', onInteraction, { passive: true });
    document.addEventListener('keydown', onInteraction);
    return () => {
      document.removeEventListener('pointerdown', onInteraction);
      document.removeEventListener('keydown', onInteraction);
    };
  }, []);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <VoiceProvider>
          <ToastProvider>
            <DeepLinkErrorReporter />
            <VoicePreferenceSync />
            <AppRoutes />
          </ToastProvider>
        </VoiceProvider>
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </BrowserRouter>
  );
}
