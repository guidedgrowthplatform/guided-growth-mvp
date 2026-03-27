import { Navigate, Routes, Route, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AdminPage } from '@/pages/AdminPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
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
import { OnboardingGuard } from './OnboardingGuard';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

function ProtectedLayout() {
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
            <OnboardingGuard mode="onboarding">
              <Step1Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/step-2"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <Step2Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/step-3"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <Step3Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/step-4"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <Step4Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/step-5"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <Step5Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/step-6"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <Step6Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/step-7"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <PlanReviewPage />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/edit-habit"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <EditHabitPage />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/advanced-input"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <AdvancedInputPage />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/advanced-results"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <AdvancedResultsPage />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/advanced-step-6"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <AdvancedStep6Page />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/advanced-custom-prompts"
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="onboarding">
              <AdvancedCustomPromptsPage />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />

      {/* Main app (protected, with Layout) */}
      <Route
        element={
          <ProtectedRoute>
            <OnboardingGuard mode="app">
              <ProtectedLayout />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="capture" element={<CapturePage />} />
        <Route path="configure" element={<ConfigurePage />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="report" element={<InsightsPage />} />
        <Route path="report/calendar" element={<CalendarPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="habit/:habitId" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
