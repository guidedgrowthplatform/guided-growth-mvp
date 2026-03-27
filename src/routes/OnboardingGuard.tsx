import { Navigate } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { useOnboarding } from '@/hooks/useOnboarding';

const BEGINNER_RESUME: Record<number, string> = {
  0: '/onboarding',
  1: '/onboarding/step-2',
  2: '/onboarding/step-3',
  3: '/onboarding/step-4',
  4: '/onboarding/step-5',
  5: '/onboarding/step-6',
  6: '/onboarding/step-7',
};

const ADVANCED_RESUME: Record<number, string> = {
  0: '/onboarding',
  1: '/onboarding/step-2',
  2: '/onboarding/advanced-input',
  3: '/onboarding/advanced-results',
  4: '/onboarding/advanced-step-6',
  5: '/onboarding/step-7',
};

function getResumeRoute(state: { current_step: number; path: string | null } | null): string {
  if (!state) return '/onboarding';
  const map = state.path === 'advanced' ? ADVANCED_RESUME : BEGINNER_RESUME;
  return map[state.current_step] ?? '/onboarding';
}

interface OnboardingGuardProps {
  mode: 'onboarding' | 'app';
  children: React.ReactNode;
}

export function OnboardingGuard({ mode, children }: OnboardingGuardProps) {
  const { state, isLoading, isCompleted } = useOnboarding();

  if (isLoading) return <SplashScreen />;

  if (mode === 'onboarding' && isCompleted) {
    return <Navigate to="/home" replace />;
  }

  if (mode === 'app' && !isCompleted) {
    return <Navigate to={getResumeRoute(state)} replace />;
  }

  return <>{children}</>;
}
