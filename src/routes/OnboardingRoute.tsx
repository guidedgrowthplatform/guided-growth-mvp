import { Navigate } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { state: onboardingState, isLoading: onboardingLoading } = useOnboarding();

  if (authLoading || onboardingLoading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // If onboarding is already completed, redirect to home
  if (onboardingState?.status === 'completed') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
