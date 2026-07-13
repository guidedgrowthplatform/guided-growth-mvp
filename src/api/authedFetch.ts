import { Capacitor } from '@capacitor/core';
import { getToken, getFreshToken, refreshOnce } from '@/lib/auth/tokenStore';
import { supabase, sessionReady } from '@/lib/supabase';

function withAuth(options: RequestInit, token: string | null): RequestInit {
  if (!token) return options;
  return {
    ...options,
    headers: { ...(options.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  };
}

// refreshSession emits no event on failure — drive the existing logout
function endSession(): Promise<void> {
  return supabase.auth.signOut({ scope: 'local' }).then(() => undefined);
}

export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (Capacitor.isNativePlatform()) {
    await sessionReady;
  }

  const hadSession = getToken() !== null;
  const token = await getFreshToken();
  const response = await fetch(url, withAuth(options, token));
  if (response.status !== 401) return response;

  const result = await refreshOnce();
  if (result.status === 'refreshed') {
    const retry = await fetch(url, withAuth(options, result.token));
    // Supabase just refreshed → session is alive. A persistent API 401 is a
    // server-side fault; killing the session here logged users out on API blips.
    if (retry.status === 401) console.warn('[auth] API rejects freshly refreshed token', url);
    return retry;
  }
  if (result.status === 'terminal' && hadSession) await endSession();
  return response;
}
