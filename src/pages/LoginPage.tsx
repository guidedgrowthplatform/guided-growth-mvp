import { Navigate, useSearchParams } from 'react-router-dom';
import { initiateGoogleLogin } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

const ERROR_MESSAGES: Record<string, string> = {
  not_invited: 'Your account is not on the invite list. Contact your admin to request access.',
  disabled: 'Your account has been disabled. Contact your admin.',
  no_code: 'Something went wrong during sign-in. Please try again.',
  token_failed: 'Something went wrong during sign-in. Please try again.',
  no_email: 'Something went wrong during sign-in. Please try again.',
  server_error: 'Something went wrong during sign-in. Please try again.',
};

export function LoginPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;

  if (user) {
    return <Navigate to="/capture" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="glass mx-4 w-full max-w-md rounded-2xl border border-cyan-200/50 p-8 text-center shadow-2xl">
        <h1 className="mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-3xl font-bold text-transparent">
          Life Growth Tracker
        </h1>
        <p className="mb-8 text-slate-600">Track your habits, grow every day.</p>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <Button
          size="lg"
          onClick={() => initiateGoogleLogin()}
          className="flex w-full items-center justify-center gap-3"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </Button>

        <p className="mt-6 text-xs text-slate-500">
          Access is invite-only. Contact your admin to get started.
        </p>
      </div>
    </div>
  );
}
