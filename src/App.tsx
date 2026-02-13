import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
import { ReportPage } from '@/pages/ReportPage';
import { AdminPage } from '@/pages/AdminPage';

function ProtectedRoutes() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/capture" replace />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/report" element={<ReportPage />} />
          {user.role === 'admin' && <Route path="/admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/capture" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
