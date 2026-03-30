import { Capacitor } from '@capacitor/core';
import { createAuthClient } from 'better-auth/react';

function getBaseURL(): string {
  const envUrl = import.meta.env.VITE_BETTER_AUTH_URL;
  if (envUrl) return envUrl;

  // On web, empty string means same-origin — works fine.
  // In Capacitor, the origin is capacitor://localhost which isn't valid HTTP,
  // so we must have an explicit URL.
  if (Capacitor.isNativePlatform()) {
    throw new Error(
      'VITE_BETTER_AUTH_URL must be set for Capacitor builds (e.g. https://your-app.vercel.app)',
    );
  }

  return '';
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  fetchOptions: { credentials: 'include' },
});
