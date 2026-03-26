// Simple in-memory rate limiter for Vercel serverless functions.
//
// KNOWN LIMITATION (MVP): Each cold start resets the in-memory Map, so rate
// limits are only enforced within a single warm invocation lifecycle. This is
// acceptable for MVP traffic levels. For production at scale, replace with
// Vercel KV (Redis) or Edge Middleware for persistent, cross-instance limiting.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limiters = new Map<string, Map<string, RateLimitEntry>>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Namespace for different endpoints
}

/**
 * Check if a request should be rate-limited.
 * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): { limited: boolean; retryAfter?: number } {
  const { windowMs, maxRequests, keyPrefix } = options;

  if (!limiters.has(keyPrefix)) {
    limiters.set(keyPrefix, new Map());
  }
  const store = limiters.get(keyPrefix)!;

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

// Cleanup stale entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [, store] of limiters) {
      for (const [key, entry] of store) {
        if (now >= entry.resetAt) store.delete(key);
      }
    }
  },
  5 * 60 * 1000,
).unref?.();
