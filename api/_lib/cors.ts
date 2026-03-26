import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Origins allowed to make cross-origin requests.
 * Capacitor iOS: capacitor://localhost
 * Capacitor Android: http://localhost
 */
const CAPACITOR_ORIGINS = new Set(['capacitor://localhost', 'http://localhost']);

/**
 * Set CORS headers when the request comes from a Capacitor WebView
 * (or another trusted origin). Returns true if the origin was allowed.
 *
 * Usage:
 *   const corsOk = setCorsHeaders(req, res);
 *   if (req.method === 'OPTIONS') return res.status(corsOk ? 204 : 403).end();
 */
export function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;

  const vercelOrigin = process.env.BETTER_AUTH_URL;
  const isAllowed = CAPACITOR_ORIGINS.has(origin) || (vercelOrigin && origin === vercelOrigin);

  if (!isAllowed) return false;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}

/**
 * Wrap a Vercel handler with automatic CORS support for Capacitor origins.
 * Handles OPTIONS preflight and sets appropriate headers on all responses.
 */
export function withCors(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void> | void,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const corsOk = setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(corsOk ? 204 : 403).end();
    }
    return handler(req, res);
  };
}
