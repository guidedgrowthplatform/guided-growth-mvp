import { Capacitor } from '@capacitor/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { track } from '@/analytics';
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
import { supabase } from '@/lib/supabase';
import { loginSchema, type LoginForm } from '@/lib/validation';

export function SignUpPage() {
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailRef = useRef('');

  useEffect(() => {
    // Per posthog.txt spec v6.0 §3.1: include referrer + UTM attribution params
    // so the Signup-to-Activation funnel can be sliced by acquisition source.
    const params = new URLSearchParams(window.location.search);
    track('view_signup_screen', {
      referrer: document.referrer || null,
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
    });
  }, []);

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
    emailRef.current = data.email;
    const result = await signUp(data.email, data.password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.confirmationPending) {
      setConfirmationPending(true);
    }
  };

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !emailRef.current) return;
    const emailRedirectTo = Capacitor.isNativePlatform()
      ? 'guidedgrowth://auth/callback'
      : `${window.location.origin}/auth/callback`;
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: emailRef.current,
      options: { emailRedirectTo },
    });
    if (resendError) {
      setError(resendError.message);
    } else {
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [resendCooldown]);

  if (confirmationPending) {
    return (
      <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <AuthBackButton />

        <div className="mt-6">
          <h1 className="text-[30px] font-bold tracking-tight text-content">Check Your Email</h1>
          <p className="mt-2 text-base text-content-secondary">
            We sent a verification link to{' '}
            <strong>
              {/* eslint-disable-next-line react-hooks/refs -- email is captured on submit, stable for the confirmation-pending render */}
              {emailRef.current}
            </strong>
            . Click the link in the email to verify your account.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <AuthAlert
            type="info"
            message="Didn't receive the email? Check your spam folder or resend it below."
          />
          {error && <AuthAlert type="error" message={error} />}
          <Button
            variant="secondary"
            size="auth"
            fullWidth
            onClick={handleResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
          </Button>
        </div>

        <div className="flex-1" />

        <div className="pb-4">
          <p className="text-center text-sm text-content-secondary">
            <Link to="/login" className="font-medium text-primary">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-[30px] font-bold tracking-tight text-content">Create an Account</h1>
        <p className="mt-2 text-base text-content-secondary">
          Start building better habits and tracking your mood today.
        </p>
      </div>

      <div className="mt-8">
        <SocialAuthButtons disabled={loading} />
      </div>

      <div className="mt-8">
        <AuthDivider text="OR CONTINUE WITH EMAIL" uppercase bold />
      </div>

      {/* eslint-disable-next-line react-hooks/refs -- react-hook-form handleSubmit is stable by design */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          variant="auth"
          placeholder="Email Address"
          type="email"
          disabled={loading}
          {...register('email')}
          error={errors.email?.message}
        />
        <Input
          variant="auth"
          type="password"
          placeholder="Password"
          showPasswordToggle
          disabled={loading}
          {...register('password')}
          error={errors.password?.message}
        />
        <div className="mt-2">
          <Button variant="primary" size="auth" fullWidth type="submit" loading={loading}>
            Sign Up
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
