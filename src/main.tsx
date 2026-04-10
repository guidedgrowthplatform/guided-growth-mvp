import { Capacitor } from '@capacitor/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from '@/lib/supabase';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry';
import './index.css';

export let deepLinkAuthError: string | null = null;

initSentry();
initAnalytics();

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

    const hashIndex = url.indexOf('#');
    if (hashIndex >= 0) {
      const hash = url.substring(hashIndex + 1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        lastHandledUrl = url;
        const type = params.get('type');
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
    <App />
  </React.StrictMode>,
);
