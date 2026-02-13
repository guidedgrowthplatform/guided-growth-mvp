const CACHE_PREFIX = 'lgt_cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export const cache = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl: ttlMs };
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // localStorage full or unavailable
    }
  },

  invalidate(key: string): void {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  },

  invalidatePattern(pattern: string): void {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(CACHE_PREFIX) && k.includes(pattern)
    );
    keys.forEach((k) => localStorage.removeItem(k));
  },

  clear(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  },
};

/** Read-through cache: returns cached data if valid, else calls fetcher and caches result */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  cache.set(key, data, ttlMs);
  return data;
}
