import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { authClient } from '@/lib/auth-client';
import { getDataService } from '@/lib/services/service-provider';
// Note: direct Supabase queries removed from ProtectedLayout — all data access
// goes through API or DataService to avoid RLS issues under Better Auth.
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

// Lazy-loaded pages for code splitting
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

// Onboarding pages (lazy — only loaded when user hits onboarding flow)
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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const habitMatch = useMatch('/habit/:habitId');
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Check onboarding status — redirect new users to /onboarding.
  // Uses server-side API to check if user has any data (habits or metrics).
  // Fail-open: if check fails or is ambiguous, allow access to prevent loops.
  useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      try {
        const { data: session } = await authClient.getSession();
        const uid = session?.user?.id;
        if (!uid) {
          setOnboardingChecked(true);
          return;
        }

        // Check if user has ANY data via server-side APIs (authenticated)
        // Both use Better Auth session cookie → proper user isolation
        const [metricsRes, prefsRes] = await Promise.all([
          fetch('/api/metrics', { credentials: 'include' }).catch(() => null),
          fetch('/api/preferences', { credentials: 'include' }).catch(() => null),
        ]);

        if (cancelled) return;

        // If either API returns data, user has been through some setup
        let hasData = false;

        if (metricsRes?.ok) {
          const metrics = await metricsRes.json();
          if (Array.isArray(metrics) && metrics.length > 0) hasData = true;
        }

        if (!hasData && prefsRes?.ok) {
          const prefs = await prefsRes.json();
          // prefs is null for new users (no row in user_preferences)
          if (prefs !== null && prefs !== undefined && prefs.default_view) hasData = true;
        }

        // Also check via DataService (getHabits uses authenticated user ID)
        if (!hasData) {
          try {
            const ds = await getDataService();
            const habits = await ds.getHabits();
            if (habits.length > 0) hasData = true;
          } catch {
            // DataService failed — treat as new user, redirect to onboarding
            // (if it's a transient error, user can navigate back)
          }
        }

        if (cancelled) return;

        if (!hasData) {
          navigate('/onboarding', { replace: true });
          return;
        }
      } catch {
        // Non-blocking: allow access if check fails (fail-open)
      }

      if (!cancelled) {
        setOnboardingChecked(true);
      }
    }

    checkOnboarding();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    getDataService()
      .then(() => {
        qc.invalidateQueries();
      })
      .catch(console.error);
  }, [qc]);

  if (!onboardingChecked) {
    return null;
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

        {/* Onboarding (protected, no Layout) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Step1Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/step-2"
          element={
            <ProtectedRoute>
              <Step2Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/step-3"
          element={
            <ProtectedRoute>
              <Step3Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/step-4"
          element={
            <ProtectedRoute>
              <Step4Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/step-5"
          element={
            <ProtectedRoute>
              <Step5Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/step-6"
          element={
            <ProtectedRoute>
              <Step6Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/step-7"
          element={
            <ProtectedRoute>
              <PlanReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/edit-habit"
          element={
            <ProtectedRoute>
              <EditHabitPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/advanced-input"
          element={
            <ProtectedRoute>
              <AdvancedInputPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/advanced-results"
          element={
            <ProtectedRoute>
              <AdvancedResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/advanced-step-6"
          element={
            <ProtectedRoute>
              <AdvancedStep6Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/advanced-custom-prompts"
          element={
            <ProtectedRoute>
              <AdvancedCustomPromptsPage />
            </ProtectedRoute>
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
