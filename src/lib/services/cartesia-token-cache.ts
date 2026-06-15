// Warms a short-lived Cartesia access token off the TTS connect path.
import { getApiBase, getAuthHeaders } from '@/lib/services/api-auth';

// margin under the server's 60s mint window
const TOKEN_TTL_MS = 45_000;
const MINT_TIMEOUT_MS = 6000;
// re-mint under the TTL so an armed voice-out always has a fresh token ready
const TOKEN_REWARM_MS = 35_000;

interface CachedToken {
  accessToken: string;
  mintedAt: number;
}

let cached: CachedToken | null = null;
let inFlight: Promise<string> | null = null;
let warmLoopHandle: ReturnType<typeof setInterval> | null = null;
let warmLoopActive = false;

async function fetchAccessToken(): Promise<string> {
  const headers = await getAuthHeaders();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MINT_TIMEOUT_MS);
  try {
    const res = await fetch(`${getApiBase()}/api/cartesia-token`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`cartesia-token ${res.status}`);
    const data = await res.json();
    if (!data.accessToken || typeof data.accessToken !== 'string') {
      throw new Error('cartesia-token empty');
    }
    return data.accessToken;
  } finally {
    clearTimeout(timer);
  }
}

function freshToken(now: number): CachedToken | null {
  return cached && now - cached.mintedAt < TOKEN_TTL_MS ? cached : null;
}

function prefetchAccessToken(): void {
  if (freshToken(Date.now()) || inFlight) return;
  inFlight = fetchAccessToken()
    .then((accessToken) => {
      cached = { accessToken, mintedAt: Date.now() };
      return accessToken;
    })
    .catch(() => '')
    .finally(() => {
      inFlight = null;
    });
}

function refillIfArmed(): void {
  if (warmLoopActive) prefetchAccessToken();
}

// Unlike Soniox single-use keys, a token is reusable until it expires — so the
// cache is NOT cleared on take; freshToken's TTL check governs reuse.
export async function takeAccessToken(): Promise<{ accessToken: string; cached: boolean }> {
  let warm = freshToken(Date.now());
  if (warm) return { accessToken: warm.accessToken, cached: true };
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      /* fall through to live mint */
    }
    warm = freshToken(Date.now());
    if (warm) return { accessToken: warm.accessToken, cached: true };
  }
  const accessToken = await fetchAccessToken();
  cached = { accessToken, mintedAt: Date.now() };
  refillIfArmed();
  return { accessToken, cached: false };
}

export function startTokenWarmLoop(): void {
  warmLoopActive = true;
  prefetchAccessToken();
  if (warmLoopHandle === null) {
    warmLoopHandle = setInterval(prefetchAccessToken, TOKEN_REWARM_MS);
  }
}

export function stopTokenWarmLoop(): void {
  warmLoopActive = false;
  if (warmLoopHandle !== null) {
    clearInterval(warmLoopHandle);
    warmLoopHandle = null;
  }
}
