import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { supabase } from '@/lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      try {
        await supabase.auth.exchangeCodeForSession(window.location.search);
        await new Promise((resolve) => setTimeout(resolve, 100));
        navigate('/');
      } catch (error) {
        console.error('OAuth callback failed:', error);
        navigate('/login');
      }
    }

    handleCallback();
  }, [navigate]);

  return <SplashScreen />;
}
