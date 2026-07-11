import { Capacitor } from '@capacitor/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initAnalytics } from '@/analytics';
import { InputMethodProvider } from '@/contexts/InputMethodContext';
import {
  type AuthHandoffKind,
  setPendingAuthError,
  setPendingAuthHandoff,
} from '@/lib/auth/authHandoff';
import { getFreshToken } from '@/lib/auth/tokenStore';
import { captureDebugFlag } from '@/lib/debug/debugFlag';
import { hydratePersistentFlags } from '@/lib/storage/persistentFlags';
import { supabase } from '@/lib/supabase';
import App from './App';
import { registerBundledIcons } from './lib/icons/registerIcons';
import { trackOpenApp } from './lib/openAppTracking';
import { initSentry } from './lib/sentry';
import './index.css';

captureDebugFlag();
registerBundledIcons();
initSentry();
initAnalytics();
trackOpenApp(Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web');

// Disable pinch-to-zoom only in native Capacitor shell
if (Capacitor.isNativePlatform()) {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    );
  }
}

// Handle OAuth deep link callbacks on native (guidedgrowth://auth/callback#access_token=...)
if (Capacitor.isNativePlatform()) {
  let lastHandledUrl = '';

  const handleDeepLink = async (url: string) => {
    if (url === lastHandledUrl) return;

    const urlObj = new URL(url);

    if (urlObj.host === 'auth' && urlObj.pathname === '/handoff') {
      lastHandledUrl = url;
      const confirmed = urlObj.searchParams.get('confirmed') === '1';
      const reset = urlObj.searchParams.get('reset') === '1';
      const kind: AuthHandoffKind | null = confirmed
        ? 'email_confirmed'
        : reset
          ? 'password_reset'
          : null;
      const { Browser } = await import('@capacitor/browser');
      Browser.close().catch(() => {});
      if (kind) {
        setPendingAuthHandoff(kind);
        window.dispatchEvent(new CustomEvent<AuthHandoffKind>('auth:handoff', { detail: kind }));
      }
      return;
    }

    // PKCE flow: code is in query params
    const code = urlObj.searchParams.get('code');
    if (code) {
      lastHandledUrl = url;
      const cal = await import('@/api/calendar');
      // Consume the fallback flag unconditionally (bounded TTL) alongside the query param.
      const isCalendar =
        urlObj.searchParams.get('intent') === 'calendar' || cal.consumeCalendarConnectPending();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      const { Browser } = await import('@capacitor/browser');
      Browser.close().catch(() => {});

      if (error) {
        setPendingAuthError(error.message);
        window.dispatchEvent(new CustomEvent('auth:error'));
        return;
      }

      // Calendar grant (not a login): capture the Google refresh token, stay on Settings.
      // Native has no page reload, so refetch the calendar status so the UI flips to connected.
      if (isCalendar) {
        const refreshToken = data.session?.provider_refresh_token;
        if (refreshToken) {
          try {
            await cal.connectCalendar(refreshToken);
            const { queryClient, queryKeys } = await import('@/lib/query');
            void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
          } catch (e) {
            console.warn('[calendar] connect POST failed', e);
          }
        }
      }
      return;
    }

    // Implicit flow fallback: tokens in hash fragment
    const hashIndex = url.indexOf('#');
    if (hashIndex >= 0) {
      const hash = url.substring(hashIndex + 1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        lastHandledUrl = url;
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const { Browser } = await import('@capacitor/browser');
        Browser.close().catch(() => {});

        if (error) {
          setPendingAuthError(error.message);
          window.dispatchEvent(new CustomEvent('auth:error'));
        }
      }
    }
  };

  import('@capacitor/app').then(({ App: CapApp }) => {
    // Cold start: app launched from deep link
    CapApp.getLaunchUrl().then((result) => {
      if (result?.url) handleDeepLink(result.url);
    });

    // Warm start: app brought to foreground via deep link
    CapApp.addListener('appUrlOpen', ({ url }) => {
      handleDeepLink(url);
    });

    // Pause refresh in background; on resume refresh the lapsed token
    // before React's resume refetch burst fires.
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        void supabase.auth.stopAutoRefresh();
        return;
      }
      void supabase.auth.startAutoRefresh();
      void getFreshToken();
    });
  });
}

hydratePersistentFlags().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <InputMethodProvider>
        <App />
      </InputMethodProvider>
    </React.StrictMode>,
  );
});
