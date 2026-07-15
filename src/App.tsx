import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { DevDbTargetBanner } from '@/components/dev/DevDbTargetBanner';
import { ScreenTimeCoachBridge } from '@/components/screentime/ScreenTimeCoachBridge';
import { OnboardingVoiceProvider } from '@/contexts/OnboardingVoiceProvider';
import { SessionLogProvider } from '@/contexts/SessionLogProvider';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { VoiceProvider } from '@/contexts/VoiceContext';
import { useNavigateLogger } from '@/hooks/useNavigateLogger';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import {
  type AuthHandoffKind,
  consumePendingAuthError,
  consumePendingAuthHandoff,
} from '@/lib/auth/authHandoff';
import { getFreshToken } from '@/lib/auth/tokenStore';
import { queryClient } from '@/lib/query';
import { reacquireIfActive, suspendWakeLock } from '@/lib/services/keepAwake';
import { fireWarmup } from '@/lib/services/warmup';
import { QAFab } from '@/onboarding-flow/QAFab';
import { QASoundToggle } from '@/onboarding-flow/QASoundToggle';
import { QAVapiToggle } from '@/onboarding-flow/QAVapiToggle';
import { AppRoutes } from '@/routes';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

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
    // sessionStorage is the single source of truth; the event is just a poke.
    const flush = () => {
      const msg = consumePendingAuthError();
      if (msg) addToast('error', msg);
    };
    flush();
    window.addEventListener('auth:error', flush);
    return () => window.removeEventListener('auth:error', flush);
  }, [addToast]);
  return null;
}

function AuthHandoffListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const go = (kind: AuthHandoffKind) => {
      const message =
        kind === 'email_confirmed'
          ? 'Email verified! Sign in to continue.'
          : 'Password updated! Sign in with your new password.';
      navigate('/login', { replace: true, state: { message } });
    };
    const pending = consumePendingAuthHandoff();
    if (pending) go(pending);
    const onEvent = (e: Event) => go((e as CustomEvent<AuthHandoffKind>).detail);
    window.addEventListener('auth:handoff', onEvent);
    return () => window.removeEventListener('auth:handoff', onEvent);
  }, [navigate]);
  return null;
}

function NavigateLogger() {
  useNavigateLogger();
  return null;
}

function PushRegistrar() {
  usePushRegistration();
  return null;
}

export default function App() {
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  // Fire a cheap no-auth warmup hit at app open so the LLM function + pg pool
  // (cold start ~2.5-3.1s, pool connect ~2.8s) are already warm before the
  // user's first real opener fires post-login/home-render.
  useEffect(() => {
    fireWarmup();
  }, []);

  // GLOB-03: gesture or visibilitychange reactivates system-grayed mic.
  useEffect(() => {
    const onInteraction = () => {
      useVoiceSettingsStore.getState().reactivateIfSystemPaused();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        onInteraction();
        // #208: web wake-lock auto-released on hide — reacquire if still active.
        void reacquireIfActive();
        // Warm a fresh token in parallel so the next request isn't stale.
        void getFreshToken();
      } else {
        // Release on background for battery; reacquired above on return.
        void suspendWakeLock();
      }
    };
    document.addEventListener('pointerdown', onInteraction, { passive: true });
    document.addEventListener('keydown', onInteraction);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('pointerdown', onInteraction);
      document.removeEventListener('keydown', onInteraction);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SessionLogProvider>
          <VoiceProvider>
            <ToastProvider>
              <DevDbTargetBanner />
              <DeepLinkErrorReporter />
              <AuthHandoffListener />
              <NavigateLogger />
              <PushRegistrar />
              <ScreenTimeCoachBridge />
              <OnboardingVoiceProvider>
                <AppRoutes />
                {/* QA pill row — fixed top-right, only in QA/dev builds */}
                <div
                  style={{
                    position: 'fixed',
                    top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
                    right: 8,
                    zIndex: 2147483647,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <QAVapiToggle />
                  <QASoundToggle />
                  <QAFab />
                </div>
              </OnboardingVoiceProvider>
            </ToastProvider>
          </VoiceProvider>
        </SessionLogProvider>
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </BrowserRouter>
  );
}
