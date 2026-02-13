import { apiGet, apiPost } from './client';
import type { User } from '@shared/types';

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiGet<User>('/auth/me');
  } catch {
    return null;
  }
}

export function initiateGoogleLogin(): void {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  window.location.href = `${apiUrl}/auth/google`;
}

export async function logout(): Promise<void> {
  await apiPost('/auth/logout', {});
  window.location.href = '/';
}
