import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { useAppGate } from '@/hooks/useAppGate';
import { useAuthStore } from '@/stores/authStore';

/** Minimum time (ms) to show splash so voice intro can play */
const MIN_SPLASH_MS = 3000;

/**
 * Global flag — once ANY AppGate finishes its splash, all subsequent
 * AppGate mounts skip the splash entirely (e.g. after redirect to /login).
 */
let globalSplashDone = false;

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg font-medium text-gray-800">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700"
      >
        Retry
      </button>
    </div>
  );
}

export function AppGate({
  children,
  allow,
}: {
  children: ReactNode;
  allow: 'public' | 'onboarding' | 'app';
}) {
  const gate = useAppGate();
  const isRecoveryMode = useAuthStore((s) => s.isRecoveryMode);
  const [splashReady, setSplashReady] = useState(globalSplashDone);

  // Show splash for MIN_SPLASH_MS only on the very first AppGate mount
  useEffect(() => {
    if (globalSplashDone) {
      setSplashReady(true);
      return;
    }
    const timer = setTimeout(() => {
      globalSplashDone = true;
      setSplashReady(true);
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (gate.status === 'loading' || !splashReady) return <SplashScreen />;

  if (gate.status === 'error') {
    return <ErrorScreen message="Could not connect to server" onRetry={gate.retry} />;
  }

  // Recovery session users should only access /reset-password
  if (isRecoveryMode && allow !== 'public') {
    return <Navigate to="/reset-password" replace />;
  }

  // Public routes: redirect authenticated users
  if (allow === 'public') {
    if (isRecoveryMode) return <>{children}</>;
    if (gate.status === 'unauthenticated') return <>{children}</>;
    if (gate.status === 'onboarding_needed' || gate.status === 'onboarding_in_progress') {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // All protected routes: redirect unauthenticated to login
  if (gate.status === 'unauthenticated') return <Navigate to="/login" replace />;

  // Onboarding routes: only allow if not completed
  if (allow === 'onboarding') {
    if (gate.status === 'ready') return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  // App routes: redirect to onboarding if not completed
  if (gate.status === 'onboarding_needed') return <Navigate to="/onboarding" replace />;
  if (gate.status === 'onboarding_in_progress') {
    return <Navigate to={`/onboarding/step-${gate.step}`} replace />;
  }

  return <>{children}</>;
}
