import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const { error: authError } = await signUp(data.email, data.password);
    setLoading(false);
    if (authError) {
      setError(authError);
    } else {
      navigate('/login', { state: { message: 'Account created! You can now sign in.' } });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary p-6">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-[30px] font-bold tracking-tight text-primary">Create an Account</h1>
        <p className="mt-2 text-base text-content-secondary">
          Start building better habits and tracking your mood today.
        </p>
      </div>

      <div className="mt-8">
        <SocialAuthButtons />
      </div>

      <div className="mt-8">
        <AuthDivider text="OR CONTINUE WITH EMAIL" uppercase bold />
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
        <div className="mt-2">
          <Button variant="primary" size="auth" fullWidth type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'Sign Up'}
          </Button>
        </div>
        {error && <AuthAlert type="error" message={error} />}
      </form>

      <div className="flex-1" />

      <div className="pb-4">
        <AuthFooter text="Already have an account?" linkText="Log In" to="/login" />
      </div>
    </div>
  );
}
