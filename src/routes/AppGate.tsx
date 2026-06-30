import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppGate } from '@/hooks/useAppGate';
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
  // 'onboarding-or-public' is used ONLY by the chat-native flow route
  // (/onboarding/flow): it renders the flow for logged-out users too, because
  // the flow's first beat IS the auth/sign-up step. Every other route keeps its
  // existing gating untouched.
  allow: 'public' | 'onboarding' | 'onboarding-or-public' | 'app';
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

  // Flow route only: a logged-out user RENDERS the flow (which starts at the auth
  // beat) instead of bouncing to /login. Authenticated users fall through to the
  // shared onboarding handling below (in-progress / completed redirects intact),
  // so the auth beat auto-completes for them exactly as for allow="onboarding".
  if (allow === 'onboarding-or-public' && gate.status === 'unauthenticated') {
    return <>{children}</>;
  }

  // Unauthenticated: the chat-native flow IS the entry — its first beat handles
  // sign-up/login, so logged-out users land there instead of the old auth pages.
  if (gate.status === 'unauthenticated') {
    return <Navigate to="/onboarding/flow" replace />;
  }

  // Onboarding routes: only allow if not completed. The flow route
  // (onboarding-or-public) shares this branch for authenticated users; its
  // logged-out case is already handled above, so here it behaves exactly like
  // allow="onboarding" (completed users bounce to /, everyone else renders and
  // the auth beat auto-completes).
  if (allow === 'onboarding' || allow === 'onboarding-or-public') {
    if (gate.status === 'ready') return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  if (gate.status === 'onboarding_needed' || gate.status === 'onboarding_in_progress') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
