import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import { AuthAlert } from '@/components/auth';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { getWebOrigin } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { loginSchema } from '@/lib/validation';

type Mode = 'signup' | 'login';

// Beat 0 of the chat-native onboarding — the real signup/login entry. Reuses the
// authStore actions (same logic as SignUpPage/SignInPage). On success the user
// becomes authed and OnboardingChatPage collapses this beat → profile. Email
// signup requires verification, so it parks on a "check your email" state.
export function AuthSignupCard() {
  const { signUp, signIn, signInWithGoogle } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailRef = useRef('');

  useEffect(() => {
    track('view_signup_screen', { referrer: document.referrer || null });
  }, []);

  const heading = mode === 'signup' ? 'Create an Account' : 'Welcome back';
  const primaryLabel = mode === 'signup' ? 'Sign Up' : 'Log In';
  const footerQuestion = mode === 'signup' ? 'Already have an account?' : 'Need an account?';
  const footerAction = mode === 'signup' ? 'Log In' : 'Sign Up';

  const busy = loading || googleLoading;

  const handleApple = useCallback(() => {
    if (mode === 'signup') track('start_signup', { method: 'apple' });
    toast.addToast('info', 'Apple sign-in coming soon');
  }, [mode, toast]);

  const handleGoogle = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (mode === 'signup') track('start_signup', { method: 'google' });
    setGoogleLoading(true);
    const { error: googleError } = await signInWithGoogle();
    setGoogleLoading(false);
    if (googleError) setError(googleError);
  }, [busy, mode, signInWithGoogle]);

  const handleEmailSubmit = useCallback(async () => {
    if (busy) return;
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details');
      return;
    }
    setLoading(true);
    emailRef.current = parsed.data.email;
    if (mode === 'signup') {
      const result = await signUp(parsed.data.email, parsed.data.password);
      setLoading(false);
      if (result.error) setError(result.error);
      else if (result.confirmationPending) setConfirmationPending(true);
    } else {
      const result = await signIn(parsed.data.email, parsed.data.password);
      setLoading(false);
      if (result.error) setError(result.error);
      // Success → authStore sets `user`; OnboardingChatPage advances past Beat 0.
    }
  }, [busy, email, password, mode, signUp, signIn]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !emailRef.current) return;
    const emailRedirectTo = `${getWebOrigin()}/auth/callback?type=signup`;
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: emailRef.current,
      options: { emailRedirectTo },
    });
    if (resendError) {
      setError(resendError.message);
      return;
    }
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
  }, [resendCooldown]);

  if (confirmationPending) {
    return (
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-3">
          <div className="text-[26px] font-bold text-primary">Check Your Email</div>
          <div className="text-[15px] text-content-secondary">
            We sent a verification link to <strong>{emailRef.current}</strong>. Click it to verify
            your account, then come back to continue.
          </div>
          <AuthAlert
            type="info"
            message="Didn't receive the email? Check your spam folder or resend it below."
          />
          {error && <AuthAlert type="error" message={error} />}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={handleResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col gap-3">
        <div className="text-[26px] font-bold text-primary">{heading}</div>
        <div className="text-[15px] text-content-secondary">Your AI coach is ready</div>
        <div className="space-y-3">
          <Button variant="social-dark" size="auth" fullWidth disabled={busy} onClick={handleApple}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </Button>
          <Button
            variant="social-light"
            size="auth"
            fullWidth
            disabled={busy}
            onClick={handleGoogle}
          >
            {googleLoading ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-content-tertiary">
          <span className="h-px flex-1 bg-border" />
          or continue with email
          <span className="h-px flex-1 bg-border" />
        </div>
        <OnboardingInput
          icon="mdi:email-outline"
          placeholder="Email Address"
          type="email"
          autoComplete="email"
          disabled={busy}
          value={email}
          onChange={setEmail}
        />
        <OnboardingInput
          icon="mdi:lock-outline"
          placeholder="Password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          disabled={busy}
          value={password}
          onChange={setPassword}
          onEnter={handleEmailSubmit}
        />
        {error && <AuthAlert type="error" message={error} />}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={busy}
          onClick={handleEmailSubmit}
        >
          {primaryLabel}
        </Button>
        <div className="text-center text-[13px] text-content-secondary">
          {footerQuestion}{' '}
          <button
            type="button"
            className="font-semibold text-primary"
            disabled={busy}
            onClick={() => {
              setError(null);
              setMode(mode === 'signup' ? 'login' : 'signup');
            }}
          >
            {footerAction}
          </button>
        </div>
      </div>
    </div>
  );
}
