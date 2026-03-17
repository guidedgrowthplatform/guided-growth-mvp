import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Layout } from '@/components/layout/Layout';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
import { ReportPage } from '@/pages/ReportPage';
import { AdminPage } from '@/pages/AdminPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { getDataService } from '@/lib/services/service-provider';

// Initialize data on first load — only seed once per session
const SEED_FLAG = 'gg_data_seeded';
function useSeedData() {
  useEffect(() => {
    if (sessionStorage.getItem(SEED_FLAG)) return;
    getDataService().then(ds => ds.seedData()).then(() => {
      sessionStorage.setItem(SEED_FLAG, '1');
      window.dispatchEvent(new CustomEvent('voice-data-changed'));
    }).catch(console.error);
  }, []);
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
          <Route path="/" element={<Navigate to="/capture" replace />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/capture" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

// Login route — redirect to app if already authenticated  
function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/capture" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
