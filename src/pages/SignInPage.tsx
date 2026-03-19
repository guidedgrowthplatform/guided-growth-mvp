import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import {
  AuthBackButton,
  SocialAuthButtons,
  AuthDivider,
  AuthFooter,
  AuthAlert,
} from '@/components/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginForm } from '@/lib/validation';

export function SignInPage() {
  const { signIn } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message ?? null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(data.email, data.password);
    setLoading(false);
    if (authError) {
      setError(authError);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary p-6">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Welcome Back!</h1>
        <p className="mt-2 text-lg font-medium text-content-secondary">
          Let's check in with your habits today.
        </p>
      </div>

      <div className="mt-10">
        <SocialAuthButtons />
      </div>

      <div className="mt-4">
        <AuthDivider text="OR LOGIN WITH EMAIL" uppercase bold />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          variant="auth"
          placeholder="Email Address"
          type="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <Input
          variant="auth"
          type="password"
          placeholder="Password"
          showPasswordToggle
          {...register('password')}
          error={errors.password?.message}
        />
        <div className="mt-2 text-right">
          <Link to="/forgot-password" className="text-sm font-bold text-primary">
            Forgot Password?
          </Link>
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            size="auth-rect"
            fullWidth
            type="submit"
            disabled={loading}
            className="shadow-[0_10px_15px_-3px_rgba(19,91,236,0.3)]"
          >
            {loading ? 'Please wait...' : 'Log In'}
          </Button>
        </div>
        {successMessage && <AuthAlert type="success" message={successMessage} />}
        {error && <AuthAlert type="error" message={error} />}
      </form>

      <div className="flex-1" />

      <div className="pb-4">
        <AuthFooter text="Don't have an account?" linkText="Sign Up" to="/signup" />
      </div>
    </div>
  );
}
