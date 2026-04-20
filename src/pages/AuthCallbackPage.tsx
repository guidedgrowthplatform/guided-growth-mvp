import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { supabase } from '@/lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let handled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!handled && event === 'PASSWORD_RECOVERY') {
        handled = true;
        navigate('/reset-password', { replace: true });
      }
    });

    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');

        await supabase.auth.exchangeCodeForSession(window.location.search);

        if (handled) return;
        handled = true;

        if (type === 'signup' || type === 'email') {
          navigate('/login', {
            state: { message: 'Email verified! You can now sign in.' },
            replace: true,
          });
        } else if (type === 'recovery') {
          navigate('/reset-password', { replace: true });
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
