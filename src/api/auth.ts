import type { User } from '@shared/types';
import { apiGet } from './client';

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiGet<User>('/api/auth/me');
  } catch {
    return null;
  }
}

export function initiateGoogleLogin(): void {
  // Better Auth handles Google OAuth redirect via signIn.social()
  // This function is kept for backward compatibility but should
  // not be called directly — use authClient.signIn.social() instead
  window.location.href = '/api/auth/sign-in/social?provider=google';
}

export async function logout(): Promise<void> {
  // Better Auth handles signout via authClient.signOut()
  // This is kept for backward compatibility
  await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
  });
  window.location.href = '/';
}
