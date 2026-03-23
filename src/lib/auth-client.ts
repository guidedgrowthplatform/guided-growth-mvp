import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? import.meta.env.VITE_BETTER_AUTH_URL || window.location.origin
      : 'http://localhost:3000',
});
