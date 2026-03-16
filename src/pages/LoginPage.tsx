import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { loginSchema, type LoginForm } from '@/lib/validation';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error: authError } = isSignUp
      ? await signUp(data.email, data.password)
      : await signIn(data.email, data.password);

    setLoading(false);

    if (authError) {
      setError(authError);
    } else if (isSignUp) {
      setSuccess('Account created! You can now sign in.');
      setIsSignUp(false);
    }
  };

  const toggleMode = (signUp: boolean) => {
    setIsSignUp(signUp);
    setError(null);
    setSuccess(null);
    reset();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-bg">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-elevated">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-primary">Guided Growth</h1>
          <p className="text-content-secondary">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-content">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-content">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-12 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary transition-colors hover:text-content-secondary"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          {!isSignUp && (
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
              >
                Forgot password?
              </Link>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-content-secondary">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => toggleMode(false)}
                className="font-semibold text-primary transition-colors hover:text-primary-dark"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => toggleMode(true)}
                className="font-semibold text-primary transition-colors hover:text-primary-dark"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
