import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SignUpPage } from '@/pages/SignUpPage';

export function SignUpRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <SignUpPage />;
}
