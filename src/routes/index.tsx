import { lazy, Suspense } from 'react';
import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { usePageTracking } from '@/analytics';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppGate } from '@/hooks/useAppGate';
import { AppGate } from './AppGate';

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
const PrivacyPolicyPage = lazy(() =>
  import('@/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })),
);
const SignInPage = lazy(() =>
  import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage })),
);
const WelcomePage = lazy(() =>
  import('@/pages/WelcomePage').then((m) => ({ default: m.WelcomePage })),
);
const SplashScreenPage = lazy(() =>
  import('@/pages/SplashScreenPage').then((m) => ({ default: m.SplashScreenPage })),
);
const SignUpPage = lazy(() =>
  import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const AddHabitPage = lazy(() =>
  import('@/pages/add-habit').then((m) => ({ default: m.AddHabitPage })),
);
const StatusPage = lazy(() =>
  import('@/pages/StatusPage').then((m) => ({ default: m.StatusPage })),
);
const AuthCallbackPage = lazy(() =>
  import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const JournalFlowPage = lazy(() =>
  import('@/pages/JournalFlowPage').then((m) => ({ default: m.JournalFlowPage })),
);

const lazyOnboarding = (name: string) =>
  lazy(() =>
    import('@/pages/onboarding').then((m) => ({
      default: (m as Record<string, React.ComponentType>)[name],
    })),
  );
const Step1Page = lazyOnboarding('Step1Page');
const VoicePreferencePage = lazyOnboarding('VoicePreferencePage');
const MicPermissionPage = lazyOnboarding('MicPermissionPage');
const Step2Page = lazyOnboarding('Step2Page');
const Step3Page = lazyOnboarding('Step3Page');
const Step4Page = lazyOnboarding('Step4Page');
const Step5Page = lazyOnboarding('Step5Page');
const Step6Page = lazyOnboarding('Step6Page');
const PlanReviewPage = lazyOnboarding('PlanReviewPage');
const AdvancedInputPage = lazyOnboarding('AdvancedInputPage');
const AdvancedResultsPage = lazyOnboarding('AdvancedResultsPage');
const EditHabitPage = lazyOnboarding('EditHabitPage');
const EditJournalPage = lazyOnboarding('EditJournalPage');
const AdvancedStep6Page = lazyOnboarding('AdvancedStep6Page');
const AdvancedCustomPromptsPage = lazyOnboarding('AdvancedCustomPromptsPage');

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
    </div>
  );
}

function OnboardingEntry() {
  const gate = useAppGate();
  if (gate.status === 'loading') return <LoadingScreen />;
  if (gate.status === 'ready') return <Navigate to="/" replace />;
  if (gate.status === 'onboarding_in_progress')
    return <Navigate to={`/onboarding/step-${gate.step}`} replace />;
  return <Navigate to="/onboarding/voice-preference" replace />;
}

function AppLayout() {
  const navigate = useNavigate();
  const habitMatch = useMatch('/habit/:habitId');

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
  usePageTracking();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/welcome"
          element={
            <AppGate allow="public">
              <WelcomePage />
            </AppGate>
          }
        />
        <Route
          path="/login"
          element={
            <AppGate allow="public">
              <SignInPage />
            </AppGate>
          }
        />
        <Route
          path="/signup"
          element={
            <AppGate allow="public">
              <SignUpPage />
            </AppGate>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <AppGate allow="public">
              <ForgotPasswordPage />
            </AppGate>
          }
        />

        {/* Public status dashboard (no auth required) */}
        <Route path="/status" element={<StatusPage />} />

        <Route path="/splash" element={<SplashScreenPage />} />

        {/* Privacy policy — accessible from any state (onboarding, settings, anon) */}
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

        {/* Auth callbacks (no auth guard) */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Onboarding (protected, no Layout) */}
        <Route
          path="/onboarding"
          element={
            <AppGate allow="onboarding">
              <OnboardingEntry />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/voice-preference"
          element={
            <AppGate allow="onboarding">
              <VoicePreferencePage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/mic-permission"
          element={
            <AppGate allow="onboarding">
              <MicPermissionPage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-1"
          element={
            <AppGate allow="onboarding">
              <Step1Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-2"
          element={
            <AppGate allow="onboarding">
              <Step2Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-3"
          element={
            <AppGate allow="onboarding">
              <Step3Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-4"
          element={
            <AppGate allow="onboarding">
              <Step4Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-5"
          element={
            <AppGate allow="onboarding">
              <Step5Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-6"
          element={
            <AppGate allow="onboarding">
              <Step6Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/step-7"
          element={
            <AppGate allow="onboarding">
              <PlanReviewPage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/edit-habit"
          element={
            <AppGate allow="onboarding">
              <EditHabitPage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/edit-journal"
          element={
            <AppGate allow="onboarding">
              <EditJournalPage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/advanced-input"
          element={
            <AppGate allow="onboarding">
              <AdvancedInputPage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/advanced-results"
          element={
            <AppGate allow="onboarding">
              <AdvancedResultsPage />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/advanced-step-6"
          element={
            <AppGate allow="onboarding">
              <AdvancedStep6Page />
            </AppGate>
          }
        />
        <Route
          path="/onboarding/advanced-custom-prompts"
          element={
            <AppGate allow="onboarding">
              <AdvancedCustomPromptsPage />
            </AppGate>
          }
        />

        {/* Journal flow (protected, no Layout — full-screen wizard) */}
        <Route
          path="/journal"
          element={
            <AppGate allow="app">
              <JournalFlowPage />
            </AppGate>
          }
        />

        <Route
          path="/add-habit"
          element={
            <AppGate allow="app">
              <AddHabitPage />
            </AppGate>
          }
        />

        {/* Main app (protected, with Layout) */}
        <Route
          element={
            <AppGate allow="app">
              <AppLayout />
            </AppGate>
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
