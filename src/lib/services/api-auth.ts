import { Capacitor } from '@capacitor/core';
import { getFreshToken } from '@/lib/auth/tokenStore';
import { sessionReady } from '@/lib/supabase';

export function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[STT] VITE_API_URL not set — STT will fail on native');
  }
  return '';
}

/** Get auth headers for API calls — required in production where AUTH_BYPASS_MODE is disabled */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // native: session hydrates async from Capacitor Preferences; no-op on web
  if (Capacitor.isNativePlatform()) {
    await sessionReady;
  }
  const token = await getFreshToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
