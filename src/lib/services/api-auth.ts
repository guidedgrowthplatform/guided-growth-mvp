import { Capacitor } from '@capacitor/core';
import { supabase, sessionReady } from '@/lib/supabase';

export function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[STT] VITE_API_URL not set — STT will fail on native');
  }
  return '';
}

/** Get auth headers for API calls — required in production where AUTH_BYPASS_MODE is disabled */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    // On native, the Supabase session is loaded asynchronously from
    // Capacitor Preferences. Without awaiting sessionReady here, a voice
    // command issued immediately after app launch can race the session
    // loader: getSession() returns null, the request goes out without an
    // Authorization header, and the API returns 401. Awaiting is a no-op
    // on web (sessionReady resolves synchronously after the first
    // getSession()).
    if (Capacitor.isNativePlatform()) {
      await sessionReady;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Continue without auth
  }
  return {};
}
