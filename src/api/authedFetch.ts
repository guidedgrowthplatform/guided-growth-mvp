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

// fetch wrapper owning the token lifecycle: proactive-fresh send + 401 refresh-retry-once.
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (Capacitor.isNativePlatform()) {
    await sessionReady;
  }

  const token = getToken() ?? (await getFreshToken());
  const response = await fetch(url, withAuth(options, token));
  if (response.status !== 401) return response;

  // bare/expired 401 → one refresh, one retry
  const refreshed = await refreshOnce();
  if (refreshed) {
    return fetch(url, withAuth(options, refreshed));
  }

  // terminal refresh failure for an authed request: drive the existing
  // sessionExpiredPending logout (refreshSession emits no event on failure).
  if (token) {
    await supabase.auth.signOut({ scope: 'local' });
  }
  return response;
}
