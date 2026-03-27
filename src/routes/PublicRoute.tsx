import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-primary-bg">
        <div className="text-center">
          <div className="mb-2 animate-pulse text-2xl font-bold text-primary">Guided Growth</div>
          <div className="text-sm text-content-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
