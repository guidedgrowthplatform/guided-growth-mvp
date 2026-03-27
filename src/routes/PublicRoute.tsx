import { Navigate } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { useAuth } from '@/hooks/useAuth';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <SplashScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
