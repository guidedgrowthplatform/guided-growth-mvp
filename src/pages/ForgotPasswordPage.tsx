import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/validation';

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/login`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary-bg">
      <div className="bg-surface shadow-elevated border border-border rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Reset Password
          </h1>
          <p className="text-content-secondary">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
              Check your email for a password reset link.
            </div>
            <Link
              to="/login"
              className="inline-block text-sm text-primary hover:text-primary-dark font-semibold underline transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
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

              {error && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
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
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-content-secondary">
              Remember your password?{' '}
              <Link
                to="/login"
                className="text-primary hover:text-primary-dark font-semibold underline transition-colors"
              >
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
