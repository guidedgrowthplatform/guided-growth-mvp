import { Capacitor } from '@capacitor/core';
import { createAuthClient } from 'better-auth/react';

/**
 * Resolve the Better Auth API base URL.
 *
 * In Capacitor (native mobile), the WebView loads from a local origin
 * (capacitor://localhost on iOS, http://localhost on Android) so relative
 * API paths won't reach the server. We need the full Vercel URL.
 *
 * VITE_BETTER_AUTH_URL should be set at build time to the production URL
 * (e.g. https://guided-growth-mvp-six.vercel.app) so Capacitor builds
 * can reach the API. For web deployments, an empty string means "same
 * origin" which works fine.
 */
function resolveBaseURL(): string {
  const configured = import.meta.env.VITE_BETTER_AUTH_URL || '';

  // On native platforms, an empty baseURL would resolve to the local
  // WebView origin which has no API server. Require explicit config.
  if (Capacitor.isNativePlatform() && !configured) {
    console.error(
      '[auth-client] VITE_BETTER_AUTH_URL is not set. ' +
        'Auth will not work in Capacitor without a remote API URL.',
    );
  }

  return configured;
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  fetchOptions: {
    credentials: 'include',
  },
});
