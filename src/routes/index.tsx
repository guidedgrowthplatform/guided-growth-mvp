import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { authClient } from '@/lib/auth-client';
import { getDataService } from '@/lib/services/service-provider';
import { supabase } from '@/lib/supabase';
import { CalendarPage } from '@/pages/CalendarPage';
import { FocusPage } from '@/pages/FocusPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HabitDetailPage } from '@/pages/HabitDetailPage';
import { HabitsPage } from '@/pages/HabitsPage';
import { HomePage } from '@/pages/HomePage';
import { InsightsPage } from '@/pages/InsightsPage';
import {
  Step1Page,
  Step2Page,
  Step3Page,
  Step4Page,
  Step5Page,
  Step6Page,
  PlanReviewPage,
  AdvancedInputPage,
  AdvancedResultsPage,
  EditHabitPage,
  AdvancedStep6Page,
  AdvancedCustomPromptsPage,
} from '@/pages/onboarding';
import { SettingsPage } from '@/pages/SettingsPage';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

function ProtectedLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const habitMatch = useMatch('/habit/:habitId');
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Check onboarding status — redirect new users to /onboarding
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

        const { data, error } = await supabase
          .from('onboarding_states')
          .select('status')
          .eq('user_id', uid)
          .maybeSingle();

        if (cancelled) return;

        // Only redirect to onboarding if we got a clear "no completed" result.
        // If query errors (e.g. type mismatch, RLS), allow access (fail-open).
        if (!error && data && data.status !== 'completed') {
          navigate('/onboarding', { replace: true });
          return;
        }
        if (!error && !data) {
          // No onboarding record — check if user has habits (existing user without record)
          const { data: habits } = await supabase
            .from('user_habits')
            .select('id')
            .eq('user_id', uid)
            .limit(1);
          if (!habits || habits.length === 0) {
            navigate('/onboarding', { replace: true });
            return;
          }
        }
      } catch {
        // Non-blocking: allow access if check fails
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
  );
}
