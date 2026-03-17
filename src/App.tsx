import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryClient } from '@/lib/query';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginRoute } from '@/routes/LoginRoute';
import { ProtectedRoutes } from '@/routes/ProtectedRoutes';

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
