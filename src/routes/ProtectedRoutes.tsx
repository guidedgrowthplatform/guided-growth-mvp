import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { getDataService } from '@/lib/services/service-provider';
import { AdminPage } from '@/pages/AdminPage';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
import { HabitDetailPage } from '@/pages/HabitDetailPage';
import { HomePage } from '@/pages/HomePage';
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
import { ReportPage } from '@/pages/ReportPage';
import { SettingsPage } from '@/pages/SettingsPage';

function useSeedData() {
  const qc = useQueryClient();
  useEffect(() => {
    getDataService()
      .then((ds) => ds.seedData())
      .then(() => {
        qc.invalidateQueries();
      })
      .catch(console.error);
  }, [qc]);
}

export function ProtectedRoutes() {
  const { user } = useAuth();
  useSeedData();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname.startsWith('/onboarding')) {
    if (location.pathname === '/onboarding/advanced-step-6') return <AdvancedStep6Page />;
    if (location.pathname === '/onboarding/advanced-custom-prompts')
      return <AdvancedCustomPromptsPage />;
    if (location.pathname === '/onboarding/advanced-input') return <AdvancedInputPage />;
    if (location.pathname === '/onboarding/advanced-results') return <AdvancedResultsPage />;
    if (location.pathname === '/onboarding/edit-habit') return <EditHabitPage />;
    if (location.pathname === '/onboarding/step-2') return <Step2Page />;
    if (location.pathname === '/onboarding/step-3') return <Step3Page />;
    if (location.pathname === '/onboarding/step-4') return <Step4Page />;
    if (location.pathname === '/onboarding/step-5') return <Step5Page />;
    if (location.pathname === '/onboarding/step-6') return <Step6Page />;
    if (location.pathname === '/onboarding/step-7') return <PlanReviewPage />;
    return <Step1Page />;
  }

  const habitMatch = location.pathname.match(/^\/habit\/(.+)$/);

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/habit/:habitId" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      {habitMatch && <HabitDetailPage habitId={habitMatch[1]} onClose={() => navigate(-1)} />}
    </Layout>
  );
}
