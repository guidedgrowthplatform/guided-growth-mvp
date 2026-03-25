import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthBackButton, AuthFooter, AuthAlert } from '@/components/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/validation';

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (_data: ForgotPasswordForm) => {
    setError(null);
    setLoading(true);

    setLoading(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary p-6">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-[30px] font-bold tracking-tight text-primary">Reset Password</h1>
        <p className="mt-2 text-base text-content-secondary">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {sent ? (
        <div className="mt-8 space-y-4">
          <AuthAlert
            type="info"
            message="Password reset is not available yet. Please contact support."
          />
          <AuthFooter text="" linkText="Back to sign in" to="/login" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <Input
            variant="auth"
            type="email"
            placeholder="Email Address"
            {...register('email')}
            error={errors.email?.message}
          />
          {error && <AuthAlert type="error" message={error} />}
          <Button variant="primary" size="auth-rect" fullWidth type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      )}

      <div className="flex-1" />

      {!sent && (
        <div className="pb-4">
          <AuthFooter text="Remember your password?" linkText="Sign in" to="/login" />
        </div>
      )}
    </div>
  );
}
