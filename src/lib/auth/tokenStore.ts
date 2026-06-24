import type { Session } from '@supabase/supabase-js';

// Refresh proactively this far before expiry to beat the warm-resume burst.
const EXPIRY_SKEW_MS = 45_000;

let currentToken: string | null = null;
let expiresAtMs: number | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Only writer — fed by the canonical onAuthStateChange listener in supabase.ts.
export function setSession(session: Session | null): void {
  currentToken = session?.access_token ?? null;
  expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
}

// Synchronous hot-path read (per-chunk callers).
export function getToken(): string | null {
  return currentToken;
}

// Burst-boundary read: refresh if missing or near expiry, else return cached.
export function getFreshToken(): Promise<string | null> {
  if (currentToken && expiresAtMs && expiresAtMs - Date.now() > EXPIRY_SKEW_MS) {
    return Promise.resolve(currentToken);
  }
  return refreshOnce();
}

// Only a rejected refresh token (auth 4xx) is terminal; network/5xx blips
// keep the session so a later attempt recovers — never log out on a blip.
function isTerminalRefreshError(error: { name?: string; status?: number }): boolean {
  if (error.name === 'AuthRetryableFetchError') return false;
  return error.status === 400 || error.status === 401 || error.status === 403;
}

// Single-flight: a whole burst shares one refresh. null = terminal (→ logout).
export function refreshOnce(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  // lazy import breaks the supabase.ts <-> tokenStore.ts cycle
  const p = import('@/lib/supabase')
    .then(async ({ supabase }) => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return isTerminalRefreshError(error) ? null : currentToken;
      return data.session?.access_token ?? currentToken;
    })
    .catch(() => currentToken) // thrown = network/transient; keep session
    .finally(() => {
      if (refreshPromise === p) refreshPromise = null;
    });
  refreshPromise = p;
  return p;
}

export function __resetTokenStoreForTest(): void {
  currentToken = null;
  expiresAtMs = null;
  refreshPromise = null;
}
