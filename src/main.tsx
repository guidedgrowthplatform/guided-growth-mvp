import { Capacitor } from '@capacitor/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initAnalytics } from '@/analytics';
import { InputMethodProvider } from '@/contexts/InputMethodContext';
import { supabase } from '@/lib/supabase';
import App from './App';
import { trackOpenApp } from './lib/openAppTracking';
import { initSentry } from './lib/sentry';
import './index.css';

export let deepLinkAuthError: string | null = null;

export type AuthHandoffKind = 'email_confirmed' | 'password_reset';

const HANDOFF_STORAGE_KEY = 'auth_handoff_pending';

export function buildHandoffUrl(kind: AuthHandoffKind): string {
  const flag = kind === 'email_confirmed' ? 'confirmed=1' : 'reset=1';
  return `guidedgrowth://auth/handoff?${flag}`;
}

export function consumePendingAuthHandoff(): AuthHandoffKind | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
    if (raw === 'email_confirmed' || raw === 'password_reset') return raw;
    return null;
  } catch {
    return null;
  }
}

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
        try {
          sessionStorage.setItem(HANDOFF_STORAGE_KEY, kind);
        } catch {
          /* */
        }
        window.dispatchEvent(new CustomEvent<AuthHandoffKind>('auth:handoff', { detail: kind }));
      }
      return;
    }

    // PKCE flow: code is in query params
    const code = urlObj.searchParams.get('code');
    if (code) {
      lastHandledUrl = url;
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      const { Browser } = await import('@capacitor/browser');
      Browser.close().catch(() => {});

      if (error) {
        deepLinkAuthError = error.message;
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
          deepLinkAuthError = error.message;
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
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InputMethodProvider>
      <App />
    </InputMethodProvider>
  </React.StrictMode>,
);
