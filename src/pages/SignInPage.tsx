import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@iconify/react';
import { useCallback, useState } from 'react';
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
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { unlockTTS } from '@/lib/services/tts-service';
import { loginSchema, type LoginForm } from '@/lib/validation';

const SPLASH_HEARD_KEY = 'guided_growth_splash_heard';

export function SignInPage() {
  const { signIn } = useAuth();
  const location = useLocation();
  const voicePlayer = useVoicePlayer();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message ?? null;

  // Show the welcome voice banner only on first visit
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(
    () => !localStorage.getItem(SPLASH_HEARD_KEY),
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginForm) => {
    unlockTTS(); // Pre-unlock audio so post-auth welcome voice auto-plays
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(data.email, data.password);
    setLoading(false);
    if (authError) setError(authError);
  };

  const handlePlayWelcome = useCallback(() => {
    if (voicePlayer.state === 'playing') {
      voicePlayer.stop();
    } else {
      voicePlayer.play('splash_welcome').catch(() => {
        // Autoplay blocked or failed — dismiss banner
      });
    }
    localStorage.setItem(SPLASH_HEARD_KEY, '1');
  }, [voicePlayer]);

  const handleDismissWelcome = useCallback(() => {
    voicePlayer.stop();
    setShowWelcomeBanner(false);
    localStorage.setItem(SPLASH_HEARD_KEY, '1');
  }, [voicePlayer]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AuthBackButton />

      <div className="mt-6">
        <h1 className="text-4xl font-bold tracking-tight text-content">Welcome back!</h1>
        <p className="mt-2 text-lg font-medium text-content-secondary">
          Let's check in with your habits today.
        </p>
      </div>

      {/* Voice Journey SPLASH-01: one-time welcome voice banner */}
      {showWelcomeBanner && (
        <div
          role="button"
          tabIndex={0}
          onClick={handlePlayWelcome}
          onKeyDown={(e) => e.key === 'Enter' && handlePlayWelcome()}
          className="group relative mt-6 flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 text-left transition-all active:scale-[0.98]"
        >
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform ${voicePlayer.state === 'playing' ? 'animate-pulse' : 'group-hover:scale-110'}`}
          >
            <Icon
              icon={voicePlayer.state === 'playing' ? 'ic:round-volume-up' : 'ic:round-play-arrow'}
              width={22}
              height={22}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-content">Meet your coach</p>
            <p className="text-xs text-content-secondary">
              {voicePlayer.state === 'playing' ? 'Playing...' : 'Tap to hear a welcome message'}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDismissWelcome();
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-surface-secondary hover:text-content"
            aria-label="Dismiss welcome"
          >
            <Icon icon="ic:round-close" width={16} height={16} />
          </button>
        </div>
      )}

      <div className="mt-10">
        <SocialAuthButtons disabled={loading} />
      </div>

      <div className="mt-8">
        <AuthDivider text="OR LOGIN WITH EMAIL" uppercase bold />
      </div>

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
            loading={loading}
            className="shadow-[0_10px_15px_-3px_rgb(var(--color-primary)/0.3)]"
          >
            Log In
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
