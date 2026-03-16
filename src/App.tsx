import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryClient } from '@/lib/query';
import { getDataService } from '@/lib/services/service-provider';
import { AdminPage } from '@/pages/AdminPage';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { ReportPage } from '@/pages/ReportPage';
import { SettingsPage } from '@/pages/SettingsPage';

// Initialize data on first load
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

// Protected routes — redirect to login if not authenticated
function ProtectedRoutes() {
  const { user } = useAuth();
  useSeedData();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

// Login route — redirect to app if already authenticated
function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
