import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryClient } from '@/lib/query';
import { AppRoutes } from '@/routes';
import { useAuthStore } from '@/stores/authStore';

export default function App() {
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
