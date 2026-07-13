import { Suspense, useEffect } from 'react';
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
const CalendarStatesPreview = lazyWithRetry(() =>
  import('@/pages/CalendarStatesPreview').then((m) => ({ default: m.CalendarStatesPreview })),
);
const ScreenTimePreview = lazyWithRetry(() =>
  import('@/pages/ScreenTimePreview').then((m) => ({ default: m.ScreenTimePreview })),
);
const WeeklyCoachPreview = lazyWithRetry(() =>
  import('@/pages/WeeklyCoachPreview').then((m) => ({ default: m.WeeklyCoachPreview })),
);
const ResetLibraryPage = lazyWithRetry(() =>
  import('@/pages/ResetLibraryPage').then((m) => ({ default: m.ResetLibraryPage })),
);
const ResetFlowPreview = lazyWithRetry(() =>
  import('@/pages/ResetFlowPreview').then((m) => ({ default: m.ResetFlowPreview })),
);
const ResetNudgePreview = lazyWithRetry(() =>
  import('@/pages/ResetNudgePreview').then((m) => ({ default: m.ResetNudgePreview })),
);
const MockStoryboard = lazyWithRetry(() =>
  import('@/pages/MockStoryboard').then((m) => ({ default: m.MockStoryboard })),
);
const BlockSchedulePreview = lazyWithRetry(() =>
  import('@/pages/BlockSchedulePreview').then((m) => ({ default: m.BlockSchedulePreview })),
);
const BlockNowPreview = lazyWithRetry(() =>
  import('@/pages/BlockNowPreview').then((m) => ({ default: m.BlockNowPreview })),
);
const WeeklyCoachDetailPreview = lazyWithRetry(() =>
  import('@/pages/WeeklyCoachDetailPreview').then((m) => ({ default: m.WeeklyCoachDetailPreview })),
);
const HabitTrendPreview = lazyWithRetry(() =>
  import('@/pages/HabitTrendPreview').then((m) => ({ default: m.HabitTrendPreview })),
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
const QAControlScreen = lazyWithRetry(() =>
  import('@/onboarding-flow/QAControlScreen').then((m) => ({ default: m.QAControlScreen })),
);

// Generic QA flow preview (gated inside QA_SCREEN_ENABLED block below): renders
// any registered flow by :flowId through the engine (L1-5).
const FlowPreviewRoute = lazyWithRetry(() =>
  import('@/onboarding-flow/FlowPreviewRoute').then((m) => ({ default: m.FlowPreviewRoute })),
);

// QA control launcher: gated to QA/dev builds only. Off in production by default,
// so real users never see it. The QA build flips VITE_QA_SCREEN_ENABLED=true to
// expose /onboarding/qa. Same code, two builds, one flag.
const QA_SCREEN_ENABLED = import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

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

// Design-preview routes (the /__* mocks) are shared for review in light mode.
// Force light while a preview page is mounted and restore the user's theme on
// unmount, so viewing a mock never permanently changes their real app theme.
function ForceLight({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    html.classList.remove('dark');
    return () => {
      if (wasDark) html.classList.add('dark');
    };
  }, []);
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
    </div>
  );
}

// The old page-based onboarding is gone; the chat-native engine at
// /onboarding/flow is the single onboarding surface for everyone.
function OnboardingEntry() {
  const gate = useAppGate();
  if (gate.status === 'loading') return <LoadingScreen />;
  if (gate.status === 'ready') return <Navigate to="/" replace />;
  return <Navigate to="/onboarding/flow" replace />;
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

        {/* Status dashboard (QA/dev builds only): no auth required, so gated behind
            QA_SCREEN_ENABLED the same as the other QA-only routes below, keeping it
            unreachable in production builds. */}
        {QA_SCREEN_ENABLED && <Route path="/status" element={<StatusPage />} />}

        {/* Dev-only flow designer: preview the chat-native flow with real components */}
        {import.meta.env.DEV && <Route path="/flow-designer" element={<FlowDesignerPage />} />}

        <Route path="/splash" element={<SplashScreenPage />} />
        <Route
          path="/__calendar-states"
          element={
            <ForceLight>
              <CalendarStatesPreview />
            </ForceLight>
          }
        />
        <Route
          path="/__screentime"
          element={
            <ForceLight>
              <ScreenTimePreview />
            </ForceLight>
          }
        />
        <Route
          path="/__weekly-coach"
          element={
            <ForceLight>
              <WeeklyCoachPreview />
            </ForceLight>
          }
        />
        <Route
          path="/__reset-browse"
          element={
            <ForceLight>
              <ResetLibraryPage />
            </ForceLight>
          }
        />
        <Route
          path="/__reset-nudge"
          element={
            <ForceLight>
              <ResetNudgePreview />
            </ForceLight>
          }
        />
        <Route
          path="/__reset-flow"
          element={
            <ForceLight>
              <ResetFlowPreview />
            </ForceLight>
          }
        />
        <Route
          path="/__screentime-schedule"
          element={
            <ForceLight>
              <BlockSchedulePreview />
            </ForceLight>
          }
        />
        <Route
          path="/__screentime-blocknow"
          element={
            <ForceLight>
              <BlockNowPreview />
            </ForceLight>
          }
        />
        <Route
          path="/__coach-detail"
          element={
            <ForceLight>
              <WeeklyCoachDetailPreview />
            </ForceLight>
          }
        />
        <Route
          path="/__habit-trends"
          element={
            <ForceLight>
              <HabitTrendPreview />
            </ForceLight>
          }
        />
        <Route
          path="/__storyboard"
          element={
            <ForceLight>
              <MockStoryboard />
            </ForceLight>
          }
        />

        {/* Auth-free QA render of the unified chat-native onboarding engine (QA/dev
            builds only): gated behind QA_SCREEN_ENABLED, same as the other QA-only
            routes below, keeping it unreachable in production builds. */}
        {QA_SCREEN_ENABLED && (
          <Route path="/onboarding-flow-preview" element={<FlowOnboardingPreview />} />
        )}

        {/* QA control launcher (QA/dev builds only): pick a test user, log in / reset / re-onboard.
            No AppGate: must render for ANYONE (logged in mid-onboarding, done, or out),
            since a tester reaches it from any screen to reset. It does its own sign-in.
            NOTE: the duplicate AppGate-wrapped route that used to precede this was dead code
            (the second Route wins in React Router) and has been removed (spec STEP 7). */}
        {QA_SCREEN_ENABLED && <Route path="/onboarding/qa" element={<QAControlScreen />} />}

        {/* QA auth-free flow preview (QA/dev builds only): any registered flow by
            id or slug, no login. home-tour still stalls per beat until its engine
            adapter lands (L1-8). */}
        {QA_SCREEN_ENABLED && <Route path="/flow-preview/:flowId" element={<FlowPreviewRoute />} />}

        {/* Privacy policy -- accessible from any state (onboarding, settings, anon) */}
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
          path="/onboarding/flow"
          element={
            // Auth lives INSIDE the flow now (beat 0 is the sign-up/login step),
            // so a logged-out user renders the flow instead of bouncing to /login.
            <AppGate allow="onboarding-or-public">
              <FlowOnboarding />
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
