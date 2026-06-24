import type { Session } from '@supabase/supabase-js';

const EXPIRY_SKEW_MS = 45_000;

export type RefreshResult =
  | { status: 'refreshed'; token: string }
  | { status: 'transient' }
  | { status: 'terminal' };

let currentToken: string | null = null;
let expiresAtMs: number | null = null;
let refreshPromise: Promise<RefreshResult> | null = null;

export function setSession(session: Session | null): void {
  currentToken = session?.access_token ?? null;
  expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
}

export function getToken(): string | null {
  return currentToken;
}

export function getFreshToken(): Promise<string | null> {
  if (currentToken && expiresAtMs && expiresAtMs - Date.now() > EXPIRY_SKEW_MS) {
    return Promise.resolve(currentToken);
  }
  return refreshOnce().then((r) => {
    if (r.status === 'refreshed') return r.token;
    return r.status === 'transient' ? currentToken : null;
  });
}

function isTransientRefreshError(error: { name?: string; status?: number }): boolean {
  if (error.name === 'AuthRetryableFetchError') return true;
  const s = error.status;
  return typeof s !== 'number' || s === 0 || s === 408 || s === 429 || s >= 500;
}

export function refreshOnce(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;
  // dynamic import breaks the supabase.ts <-> tokenStore cycle
  const p: Promise<RefreshResult> = import('@/lib/supabase')
    .then(async ({ supabase }): Promise<RefreshResult> => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error)
        return isTransientRefreshError(error) ? { status: 'transient' } : { status: 'terminal' };
      return data.session
        ? { status: 'refreshed', token: data.session.access_token }
        : { status: 'terminal' };
    })
    .catch((): RefreshResult => ({ status: 'transient' }))
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
