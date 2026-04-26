import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { AuthBackButton, AuthAlert } from '@/components/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { resetPasswordSchema, type ResetPasswordForm } from '@/lib/validation';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Guard: redirect if no active session (user visited this page directly)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/forgot-password', { replace: true });
      }
    });
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    setError(null);
    setLoading(true);
    const { error: updateError } = await updatePassword(data.password);
    setLoading(false);
    if (updateError) {
      setError(updateError);
    } else {
      navigate('/login', {
        state: { message: 'Password updated! You can now sign in.' },
        replace: true,
      });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-[30px] font-bold tracking-tight text-primary">Set New Password</h1>
        <p className="mt-2 text-base text-content-secondary">Enter your new password below</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          variant="auth"
          type="password"
          placeholder="New Password"
          showPasswordToggle
          disabled={loading}
          {...register('password')}
          error={errors.password?.message}
        />
        <Input
          variant="auth"
          type="password"
          placeholder="Confirm Password"
          showPasswordToggle
          disabled={loading}
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        {error && <AuthAlert type="error" message={error} />}
        <Button variant="primary" size="auth-rect" fullWidth type="submit" loading={loading}>
          Update Password
        </Button>
      </form>

      <div className="flex-1" />
    </div>
  );
}
