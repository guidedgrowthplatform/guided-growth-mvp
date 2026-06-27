import { Suspense } from 'react';
import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { usePageTracking } from '@/analytics';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppGate } from '@/hooks/useAppGate';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { AppGate } from './AppGate';

const HomePage = lazyWithRetry(() =>
  import('@/pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const HabitsPage = lazyWithRetry(() =>
  import('@/pages/HabitsPage').then((m) => ({ default: m.HabitsPage })),
);
const HabitDetailPage = lazyWithRetry(() =>
  import('@/pages/HabitDetailPage').then((m) => ({ default: m.HabitDetailPage })),
);
const HabitReflectionPage = lazyWithRetry(() =>
  import('@/pages/HabitReflectionPage').then((m) => ({ default: m.HabitReflectionPage })),
);
const CalendarPage = lazyWithRetry(() =>
  import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const InsightsPage = lazyWithRetry(() =>
  import('@/pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
);
const FocusPage = lazyWithRetry(() =>
  import('@/pages/FocusPage').then((m) => ({ default: m.FocusPage })),
);
const SettingsPage = lazyWithRetry(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const PrivacyPolicyPage = lazyWithRetry(() =>
  import('@/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })),
);
const SignInPage = lazyWithRetry(() =>
  import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage })),
);
const WelcomePage = lazyWithRetry(() =>
  import('@/pages/WelcomePage').then((m) => ({ default: m.WelcomePage })),
);
const SplashScreenPage = lazyWithRetry(() =>
  import('@/pages/SplashScreenPage').then((m) => ({ default: m.SplashScreenPage })),
);
const SignUpPage = lazyWithRetry(() =>
  import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })),
);
const ForgotPasswordPage = lazyWithRetry(() =>
  import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const AddHabitPage = lazyWithRetry(() =>
  import('@/pages/add-habit').then((m) => ({ default: m.AddHabitPage })),
);
const StatusPage = lazyWithRetry(() =>
  import('@/pages/StatusPage').then((m) => ({ default: m.StatusPage })),
);
const FlowDesignerPage = lazyWithRetry(() =>
  import('@/pages/FlowDesignerPage').then((m) => ({ default: m.FlowDesignerPage })),
);
const AuthCallbackPage = lazyWithRetry(() =>
  import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
);
const ResetPasswordPage = lazyWithRetry(() =>
  import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const JournalFlowPage = lazyWithRetry(() =>
  import('@/pages/JournalFlowPage').then((m) => ({ default: m.JournalFlowPage })),
);
const ReflectionsListPage = lazyWithRetry(() =>
  import('@/pages/ReflectionsListPage').then((m) => ({ default: m.ReflectionsListPage })),
);
const ReflectionDetailPage = lazyWithRetry(() =>
  import('@/pages/ReflectionDetailPage').then((m) => ({ default: m.ReflectionDetailPage })),
);
const EnablePermissionsPage = lazyWithRetry(() =>
  import('@/pages/EnablePermissionsPage').then((m) => ({ default: m.EnablePermissionsPage })),
);
const NotificationsPage = lazyWithRetry(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const NotificationDetailPage = lazyWithRetry(() =>
  import('@/pages/NotificationDetailPage').then((m) => ({ default: m.NotificationDetailPage })),
);
const lazyOnboarding = (name: string) =>
  lazyWithRetry(() =>
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
const Step6PromptsPage = lazyOnboarding('Step6PromptsPage');
const PlanReviewPage = lazyOnboarding('PlanReviewPage');
const AdvancedInputPage = lazyOnboarding('AdvancedInputPage');
const AdvancedResultsPage = lazyOnboarding('AdvancedResultsPage');
const EditHabitPage = lazyOnboarding('EditHabitPage');
const EditJournalPage = lazyOnboarding('EditJournalPage');
const AdvancedStep6Page = lazyOnboarding('AdvancedStep6Page');
const AdvancedCustomPromptsPage = lazyOnboarding('AdvancedCustomPromptsPage');
const QAControlScreen = lazyWithRetry(() =>
  import('@/onboarding-flow/QAControlScreen').then((m) => ({ default: m.QAControlScreen })),
);

// QA control launcher: gated to QA/dev builds only. Off in production by default,
// so real users never see it. The QA build flips VITE_QA_SCREEN_ENABLED=true to
// expose /onboarding/qa. Same code, two builds, one flag.
const QA_SCREEN_ENABLED =
  import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

// Unified chat-native onboarding engine (orchestrator + data-driven renderer).
// /onboarding/flow = real (authed); /onboarding-flow-preview = auth-free QA render.
const FlowOnboarding = lazyWithRetry(() =>
  import('@/onboarding-flow/FlowOnboarding').then((m) => ({ default: m.FlowOnboarding })),
);
const FlowOnboardingPreview = lazyWithRetry(() =>
  import('@/onboarding-flow/FlowOnboardingPreview').then((m) => ({
    default: m.FlowOnboardingPreview,
  })),
);

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
    </div>
  );
}

// Cutover flag: when on, FRESH onboarding users get the new chat-native engine
// (/onboarding/flow) instead of the old page flow. Default off (unset) = old flow.
// In-progress users always finish on the flow they started (the engine has no old
// step state), so flipping this only affects new signups. Flip to go live.
const USE_FLOW_ENGINE = import.meta.env.VITE_ONBOARDING_USE_ENGINE === 'true';

function OnboardingEntry() {
  const gate = useAppGate();
  if (gate.status === 'loading') return <LoadingScreen />;
  if (gate.status === 'ready') return <Navigate to="/" replace />;
  // Version pinning: anyone mid old-flow finishes on the old step pages.
  if (gate.status === 'onboarding_in_progress')
    return <Navigate to={`/onboarding/step-${gate.step}`} replace />;
  // Fresh user: the new engine if the cutover flag is on, else the old flow.
  if (USE_FLOW_ENGINE) return <Navigate to="/onboarding/flow" replace />;
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

        {/* Dev-only flow designer: preview the chat-native flow with real components */}
        {import.meta.env.DEV && <Route path="/flow-designer" element={<FlowDesignerPage />} />}

        <Route path="/splash" element={<SplashScreenPage />} />

        {/* Auth-free QA render of the unified chat-native onboarding engine */}
        <Route path="/onboarding-flow-preview" element={<FlowOnboardingPreview />} />

        {/* QA control launcher (QA/dev builds only): pick a test user, log in / reset / re-onboard */}
        {QA_SCREEN_ENABLED && (
          <Route
            path="/onboarding/qa"
            element={
              <AppGate allow="public">
                <QAControlScreen />
              </AppGate>
            }
          />
        )}

        {/* Privacy policy — accessible from any state (onboarding, settings, anon) */}
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

        {/* QA control launcher (QA/dev builds only): pick a test user, log in / reset / re-onboard.
            No AppGate: it must render for ANYONE (logged in mid-onboarding, done, or out),
            since a tester reaches it from any screen to reset. It does its own sign-in. */}
        {QA_SCREEN_ENABLED && <Route path="/onboarding/qa" element={<QAControlScreen />} />}

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
          path="/onboarding/flow"
          element={
            // Auth lives INSIDE the flow now (beat 0 is the sign-up/login step),
            // so a logged-out user renders the flow instead of bouncing to /login.
            <AppGate allow="onboarding-or-public">
              <FlowOnboarding />
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
          path="/onboarding/step-6-prompts"
          element={
            <AppGate allow="onboarding">
              <Step6PromptsPage />
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
          <Route path="add-habit" element={<AddHabitPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="journal" element={<JournalFlowPage />} />
          <Route path="reflections" element={<ReflectionsListPage />} />
          <Route path="reflections/:id" element={<ReflectionDetailPage />} />
          <Route path="enable-permissions" element={<EnablePermissionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="notifications/:id" element={<NotificationDetailPage />} />
          <Route path="habit/:habitId/reflection" element={<HabitReflectionPage />} />
          <Route path="habit/:habitId" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
