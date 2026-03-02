import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Layout } from '@/components/layout/Layout';
import { CapturePage } from '@/pages/CapturePage';
import { ConfigurePage } from '@/pages/ConfigurePage';
import { ReportPage } from '@/pages/ReportPage';
import { AdminPage } from '@/pages/AdminPage';
import { mockDataService } from '@/lib/services/mock-data-service';

// Seed mock data on first load (only if localStorage is empty)
function useSeedData() {
  useEffect(() => {
    mockDataService.seedData().then(() => {
      // Trigger UI refresh after seed data is available
      window.dispatchEvent(new CustomEvent('voice-data-changed'));
    }).catch(console.error);
  }, []);
}

// Auth disabled for preview/demo — see feat/voice-integration branch
function AppRoutes() {
  useSeedData();
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/capture" replace />} />
          <Route path="/login" element={<Navigate to="/capture" replace />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/capture" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
}

