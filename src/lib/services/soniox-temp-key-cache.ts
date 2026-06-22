// Warms a single-use Soniox temp key before mic toggle, off the connect path.
import { getApiBase, getAuthHeaders } from '@/lib/services/api-auth';

// margin under the server's 300s mint window
const KEY_TTL_MS = 240_000;
// under the 7s connect watchdog, but long enough to outlast a cold mint (~5s) so the prefetch lands
const MINT_TIMEOUT_MS = 6000;
// re-mint under the TTL so an armed mic always has a fresh key ready
const KEY_REWARM_MS = 180_000;

interface CachedKey {
  apiKey: string;
  mintedAt: number;
}

let cached: CachedKey | null = null;
let inFlight: Promise<string> | null = null;
let warmLoopHandle: ReturnType<typeof setInterval> | null = null;
let warmLoopActive = false;

async function fetchTempKey(): Promise<string> {
  const headers = await getAuthHeaders();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MINT_TIMEOUT_MS);
  try {
    const res = await fetch(`${getApiBase()}/api/soniox-temp-key`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`soniox-temp-key ${res.status}`);
    const data = await res.json();
    if (!data.apiKey || typeof data.apiKey !== 'string') {
      throw new Error('soniox-temp-key empty');
    }
    return data.apiKey;
  } finally {
    clearTimeout(timer);
  }
}

// Reads module state fresh — avoids stale control-flow narrowing across awaits.
function freshKey(now: number): CachedKey | null {
  return cached && now - cached.mintedAt < KEY_TTL_MS ? cached : null;
}

export function prefetchTempKey(): void {
  if (freshKey(Date.now()) || inFlight) return;
  inFlight = fetchTempKey()
    .then((apiKey) => {
      cached = { apiKey, mintedAt: Date.now() };
      return apiKey;
    })
    .catch(() => '')
    .finally(() => {
      inFlight = null;
    });
}

// Refill the cache for the next utterance while the mic stays armed.
function refillIfArmed(): void {
  if (warmLoopActive) prefetchTempKey();
}

// Warm key consumed once; reconnects re-mint — each key opens one stream.
export async function takeTempKey(): Promise<{ apiKey: string; cached: boolean }> {
  let warm = freshKey(Date.now());
  if (warm) {
    cached = null;
    refillIfArmed();
    return { apiKey: warm.apiKey, cached: true };
  }
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      /* fall through to live mint */
    }
    warm = freshKey(Date.now());
    if (warm) {
      cached = null;
      refillIfArmed();
      return { apiKey: warm.apiKey, cached: true };
    }
  }
  const apiKey = await fetchTempKey();
  refillIfArmed();
  return { apiKey, cached: false };
}

// Keep a fresh key staged while the mic is armed (decoupled from overlay open).
export function startKeyWarmLoop(): void {
  warmLoopActive = true;
  prefetchTempKey();
  if (warmLoopHandle === null) {
    warmLoopHandle = setInterval(prefetchTempKey, KEY_REWARM_MS);
  }
}

export function stopKeyWarmLoop(): void {
  warmLoopActive = false;
  if (warmLoopHandle !== null) {
    clearInterval(warmLoopHandle);
    warmLoopHandle = null;
  }
}

export function __resetTempKeyCacheForTest(): void {
  cached = null;
  inFlight = null;
  warmLoopActive = false;
  if (warmLoopHandle !== null) {
    clearInterval(warmLoopHandle);
    warmLoopHandle = null;
  }
}
