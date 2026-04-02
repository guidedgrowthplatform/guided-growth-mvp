import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { useAppGate } from '@/hooks/useAppGate';

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

  if (gate.status === 'loading') return <SplashScreen />;

  if (gate.status === 'error') {
    return <ErrorScreen message="Could not connect to server" onRetry={gate.retry} />;
  }

  // Public routes: redirect authenticated users
  if (allow === 'public') {
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
