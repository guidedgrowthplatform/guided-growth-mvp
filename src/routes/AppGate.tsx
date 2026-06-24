import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppGate } from '@/hooks/useAppGate';
import { FIRST_OPEN, getFlag } from '@/lib/storage/persistentFlags';
import { useAuthStore } from '@/stores/authStore';

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

  if (gate.status === 'loading') return <LoadingScreen />;

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

  // Onboarding routes: the chat page IS the signup/login entry, so
  // unauthenticated users render it (Beat 0 = AuthSignupCard). Completed users
  // go home; everyone mid-onboarding renders. This is the ONLY protected surface
  // reachable while logged out — app routes below still bounce the unauthed.
  if (allow === 'onboarding') {
    if (gate.status === 'ready') return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  // Unauthenticated (app routes): first open shows splash → welcome intro, then
  // straight to login.
  if (gate.status === 'unauthenticated') {
    return <Navigate to={getFlag(FIRST_OPEN) ? '/login' : '/splash'} replace />;
  }

  if (gate.status === 'onboarding_needed' || gate.status === 'onboarding_in_progress') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
