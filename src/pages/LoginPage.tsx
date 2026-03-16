import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginForm } from '@/lib/validation';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<LoginForm>({
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
    <div className="flex items-center justify-center min-h-screen bg-primary-bg">
      <div className="bg-surface shadow-elevated border border-border rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Guided Growth
          </h1>
          <p className="text-content-secondary">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                         transition-all duration-200"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-content mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-surface
                           focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                           transition-all duration-200"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          </div>

          {!isSignUp && (
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary-dark font-semibold underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white
                       bg-primary hover:bg-primary-dark
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 shadow-lg"
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
                className="text-primary hover:text-primary-dark font-semibold underline transition-colors"
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
                className="text-primary hover:text-primary-dark font-semibold underline transition-colors"
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
