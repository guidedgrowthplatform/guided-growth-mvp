import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUserProperty, track } from '@/analytics';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let handled = false;
    const oauthIntent = window.sessionStorage.getItem('gg_oauth_intent');
    const oauthStartedAt = Number.parseInt(
      window.sessionStorage.getItem('gg_oauth_started_at') ?? '',
      10,
    );

    function clearOAuthMarkers() {
      window.sessionStorage.removeItem('gg_oauth_intent');
      window.sessionStorage.removeItem('gg_oauth_started_at');
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!handled && event === 'PASSWORD_RECOVERY') {
        handled = true;
        useAuthStore.setState({ isRecoveryMode: true });
        navigate('/reset-password', { replace: true });
      }
    });

    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        const type = params.get('type');

        await supabase.auth.exchangeCodeForSession(window.location.search);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (handled) return;
        handled = true;

        if (session?.user && oauthIntent) {
          if (oauthIntent === 'signup_google') {
            setUserProperty({ auth_method: 'google', plan_tier: 'free' });
            track(
              'complete_signup',
              {
                method: 'google',
                time_to_complete_seconds:
                  Number.isFinite(oauthStartedAt) && oauthStartedAt > 0
                    ? Math.round((Date.now() - oauthStartedAt) / 1000)
                    : undefined,
              },
              { send_instantly: true },
            );
          } else if (oauthIntent === 'login_google') {
            setUserProperty({ auth_method: 'google', plan_tier: 'free' });
            const createdAtMs = session.user.created_at
              ? new Date(session.user.created_at).getTime()
              : 0;
            const lastSignInMs = session.user.last_sign_in_at
              ? new Date(session.user.last_sign_in_at).getTime()
              : Date.now();
            track(
              'complete_login',
              {
                method: 'google',
                is_returning_user: createdAtMs > 0 && lastSignInMs - createdAtMs > 60_000,
              },
              { send_instantly: true },
            );
          }
        }
        clearOAuthMarkers();

        if (next === 'reset-password' || type === 'recovery') {
          useAuthStore.setState({ isRecoveryMode: true });
          navigate('/reset-password', { replace: true });
          return;
        }

        if (type === 'signup' || type === 'email') {
          navigate('/login', {
            state: { message: 'Email verified! You can now sign in.' },
            replace: true,
          });
        } else {
          navigate('/', { replace: true });
        }
      } catch (error) {
        if (handled) return;
        handled = true;
        if (oauthIntent === 'signup_google') {
          track('signup_error', {
            method: 'google',
            error_type: 'oauth_callback_failed',
            error_message: error instanceof Error ? error.message : 'OAuth callback failed',
          });
        } else if (oauthIntent === 'login_google') {
          track('login_error', {
            method: 'google',
            error_type: 'oauth_callback_failed',
          });
        }
        clearOAuthMarkers();
        console.error('Auth callback failed:', error);
        navigate('/login', { replace: true });
      }
    }

    handleCallback();

    return () => subscription.unsubscribe();
  }, [navigate]);

  return <LoadingScreen />;
}
