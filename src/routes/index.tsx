import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingRoute } from './OnboardingRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const HabitsPage = lazy(() =>
  import('@/pages/HabitsPage').then((m) => ({ default: m.HabitsPage })),
);
const HabitDetailPage = lazy(() =>
  import('@/pages/HabitDetailPage').then((m) => ({ default: m.HabitDetailPage })),
);
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const InsightsPage = lazy(() =>
  import('@/pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
);
const FocusPage = lazy(() => import('@/pages/FocusPage').then((m) => ({ default: m.FocusPage })));
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const SignInPage = lazy(() =>
  import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage })),
);
const SignUpPage = lazy(() =>
  import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const StatusPage = lazy(() =>
  import('@/pages/StatusPage').then((m) => ({ default: m.StatusPage })),
);
const AuthCallbackPage = lazy(() =>
  import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
);

const lazyOnboarding = (name: string) =>
  lazy(() =>
    import('@/pages/onboarding').then((m) => ({
      default: (m as Record<string, React.ComponentType>)[name],
    })),
  );
const Step1Page = lazyOnboarding('Step1Page');
const Step2Page = lazyOnboarding('Step2Page');
const Step3Page = lazyOnboarding('Step3Page');
const Step4Page = lazyOnboarding('Step4Page');
const Step5Page = lazyOnboarding('Step5Page');
const Step6Page = lazyOnboarding('Step6Page');
const PlanReviewPage = lazyOnboarding('PlanReviewPage');
const AdvancedInputPage = lazyOnboarding('AdvancedInputPage');
const AdvancedResultsPage = lazyOnboarding('AdvancedResultsPage');
const EditHabitPage = lazyOnboarding('EditHabitPage');
const AdvancedStep6Page = lazyOnboarding('AdvancedStep6Page');
const AdvancedCustomPromptsPage = lazyOnboarding('AdvancedCustomPromptsPage');

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
    </div>
  );
}

function ProtectedLayout() {
  const navigate = useNavigate();
  const habitMatch = useMatch('/habit/:habitId');
  const { state: onboardingState, isLoading: onboardingLoading } = useOnboarding();

  useEffect(() => {
    if (onboardingLoading) return;
    if (onboardingState === null) {
      navigate('/onboarding', { replace: true });
    } else if (onboardingState.status === 'in_progress') {
      navigate(`/onboarding/step-${onboardingState.current_step}`, { replace: true });
    }
  }, [onboardingState, onboardingLoading, navigate]);

  if (onboardingLoading || onboardingState === null || onboardingState.status === 'in_progress') {
    return <PageLoader />;
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      {habitMatch && (
        <HabitDetailPage habitId={habitMatch.params.habitId!} onClose={() => navigate(-1)} />
      )}
    </Layout>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <SignInPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignUpPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />

        {/* Public status dashboard (no auth required) */}
        <Route path="/status" element={<StatusPage />} />

        {/* OAuth callback (public, no auth guard) */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Onboarding (protected, no Layout) */}
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <Step1Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/step-2"
          element={
            <OnboardingRoute>
              <Step2Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/step-3"
          element={
            <OnboardingRoute>
              <Step3Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/step-4"
          element={
            <OnboardingRoute>
              <Step4Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/step-5"
          element={
            <OnboardingRoute>
              <Step5Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/step-6"
          element={
            <OnboardingRoute>
              <Step6Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/step-7"
          element={
            <OnboardingRoute>
              <PlanReviewPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/edit-habit"
          element={
            <OnboardingRoute>
              <EditHabitPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/advanced-input"
          element={
            <OnboardingRoute>
              <AdvancedInputPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/advanced-results"
          element={
            <OnboardingRoute>
              <AdvancedResultsPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/advanced-step-6"
          element={
            <OnboardingRoute>
              <AdvancedStep6Page />
            </OnboardingRoute>
          }
        />
        <Route
          path="/onboarding/advanced-custom-prompts"
          element={
            <OnboardingRoute>
              <AdvancedCustomPromptsPage />
            </OnboardingRoute>
          }
        />

        {/* Main app (protected, with Layout) */}
        <Route
          element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="report" element={<InsightsPage />} />
          <Route path="report/calendar" element={<CalendarPage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="habit/:habitId" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
