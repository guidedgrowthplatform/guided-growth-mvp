import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let handled = false;

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

        if (handled) return;
        handled = true;

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
        console.error('Auth callback failed:', error);
        navigate('/login', { replace: true });
      }
    }

    handleCallback();

    return () => subscription.unsubscribe();
  }, [navigate]);

  return <LoadingScreen />;
}
