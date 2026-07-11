import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectCalendar, consumeCalendarConnectPending, syncCalendar } from '@/api/calendar';
import { AuthResultScreen } from '@/components/auth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { consumeAuthReturnTo } from '@/lib/auth/authHandoff';
import { supabase } from '@/lib/supabase';

type Status = 'pending' | 'email_confirmed' | 'error';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    // Consume first (bounded TTL) so it can't leak to a later login — `||` would short-circuit it.
    const pendingConnect = consumeCalendarConnectPending();
    const calendarConnect = params.get('intent') === 'calendar' || pendingConnect;
    const errorDescription = params.get('error_description');
    const hasAuthParam = Boolean(params.get('code') || params.get('token_hash'));

    if (errorDescription) {
      console.warn('Auth callback error:', errorDescription);
      setStatus('error');
      return;
    }

    let handled = false;
    let eventSeen = false;
    const finish = (next: Status) => {
      if (handled) return;
      handled = true;
      setStatus(next);
    };

    const handleRecovery = () => {
      navigate('/reset-password', { replace: true });
      handled = true;
    };

    // Calendar-authorization grant (not a login): capture the Google refresh token
    // from the session and return to Settings — no login navigation.
    const handleCalendarConnect = (session: Session | null) => {
      handled = true;
      const done = () => navigate('/settings', { replace: true });
      const refreshToken = session?.provider_refresh_token;
      if (refreshToken) {
        // First connect: store token, then materialize events (creates the GG calendar).
        void connectCalendar(refreshToken).then(() => {
          void syncCalendar().catch(() => {});
          done();
        }, done);
      } else done();
    };

    const handleSignedIn = (session: Session | null) => {
      if (type === 'recovery') {
        handleRecovery();
        return;
      }
      if (calendarConnect) {
        handleCalendarConnect(session);
        return;
      }
      if (type === null) {
        handled = true;
        // OAuth round-trip: resume where sign-in started (e.g. /onboarding/flow)
        navigate(consumeAuthReturnTo() ?? '/', { replace: true });
        return;
      }
      finish('email_confirmed');
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        eventSeen = true;
        handleRecovery();
      } else if (event === 'SIGNED_IN') {
        eventSeen = true;
        handleSignedIn(session);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (handled) return;
      if (!session) {
        if (!hasAuthParam) finish('error');
        return;
      }
      eventSeen = true;
      // already-signed-in user visiting the URL without a fresh auth param
      // (covers PKCE exchange finishing before this page mounts)
      if (!hasAuthParam) {
        handled = true;
        navigate(calendarConnect ? '/settings' : (consumeAuthReturnTo() ?? '/'), {
          replace: true,
        });
        return;
      }
      if (type === 'recovery') handleRecovery();
      else handleSignedIn(session);
    });

    const timeoutId = window.setTimeout(() => {
      if (eventSeen) return;
      finish('error');
    }, 20000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, [navigate]);

  if (status === 'pending') return <LoadingScreen />;

  if (status === 'error') {
    const isRecovery = new URLSearchParams(window.location.search).get('type') === 'recovery';
    const body = isRecovery
      ? 'This password reset link is no longer valid. It may have expired, already been used, or been opened in a different browser than the one you requested it from.\n\nRequest a new reset link to continue.'
      : 'This link is no longer valid. It may have expired, already been used, or been opened in a different browser than the one you signed up from.\n\nRequest a new email or sign in if your account is already verified.';
    return (
      <AuthResultScreen
        title="Link expired or invalid"
        body={body}
        iconName="ic:round-error-outline"
        iconTone="warning"
        primaryLabel={isRecovery ? 'Send new reset link' : 'Back to sign up'}
        onPrimary={() => navigate(isRecovery ? '/forgot-password' : '/signup', { replace: true })}
        secondaryLabel="Back to sign in"
        onSecondary={() => navigate('/login', { replace: true })}
      />
    );
  }

  return (
    <AuthResultScreen
      title="Email verified!"
      body="You can now sign in to continue."
      primaryLabel="Continue to sign in"
      onPrimary={() =>
        navigate('/login', {
          replace: true,
          state: { message: 'Email verified! You can now sign in.' },
        })
      }
      handoffKind="email_confirmed"
    />
  );
}
