import { createAuthClient } from 'better-auth/react';

// Capacitor builds need a full HTTPS URL; web (same-origin) uses empty string
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || '',
  fetchOptions: { credentials: 'include' },
});
