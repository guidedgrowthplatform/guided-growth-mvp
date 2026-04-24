import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'cartesia-agent-token-ip',
  });
  if (ipRl.limited)
    return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });

  const bypassAuth =
    process.env.AUTH_BYPASS_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (!bypassAuth) {
    const user = await requireUser(req, res);
    if (!user) return;
    await setUserContext(user.id);
    const rl = checkRateLimit(user.id, {
      windowMs: 60_000,
      maxRequests: 10,
      keyPrefix: 'cartesia-agent-token',
    });
    if (rl.limited)
      return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Cartesia API key not configured', fallback: true });
  }

  try {
    const response = await fetch('https://api.cartesia.ai/access-token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cartesia-Version': '2026-03-01',
      },
      body: JSON.stringify({
        expires_in: 3600,
        grants: { agent: true },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res
        .status(response.status === 401 || response.status === 429 ? response.status : 502)
        .json({ error: 'Failed to mint access token', fallback: true });
    }

    const data: unknown = await response.json();
    const token = (data as { token?: unknown } | null)?.token;
    if (typeof token !== 'string' || token.length === 0) {
      return res
        .status(502)
        .json({ error: 'Invalid token response from upstream', fallback: true });
    }

    return res.status(200).json({ token, expires_in: 3600 });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Token request timed out', fallback: true });
    }
    return res.status(500).json({ error: 'Internal error', fallback: true });
  }
}
