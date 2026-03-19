import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { getDataService } from '@/lib/services/service-provider';
import { AdminPage } from '@/pages/AdminPage';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HabitDetailPage } from '@/pages/HabitDetailPage';
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

  useEffect(() => {
    getDataService()
      .then((ds) => ds.seedData())
      .then(() => {
        qc.invalidateQueries();
      })
      .catch(console.error);
  }, [qc]);

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
        <Route path="capture" element={<CapturePage />} />
        <Route path="configure" element={<ConfigurePage />} />
        <Route path="report" element={<InsightsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="habit/:habitId" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
