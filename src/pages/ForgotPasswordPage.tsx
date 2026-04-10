import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthBackButton, AuthFooter, AuthAlert } from '@/components/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/validation';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setError(null);
    setLoading(true);
    const { error: resetError } = await resetPassword(data.email);
    setLoading(false);
    if (resetError) {
      setError(resetError);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-[30px] font-bold tracking-tight text-primary">Reset Password</h1>
        <p className="mt-2 text-base text-content-secondary">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          variant="auth"
          type="email"
          placeholder="Email Address"
          disabled={loading || success}
          {...register('email')}
          error={errors.email?.message}
        />
        {error && <AuthAlert type="error" message={error} />}
        {success && (
          <AuthAlert
            type="success"
            message="If an account exists with that email, you'll receive a reset link shortly."
          />
        )}
        {!success && (
          <Button variant="primary" size="auth-rect" fullWidth type="submit" loading={loading}>
            Send Reset Link
          </Button>
        )}
      </form>

      <div className="flex-1" />

      <div className="pb-4">
        <AuthFooter text="Remember your password?" linkText="Sign in" to="/login" />
      </div>
    </div>
  );
}
