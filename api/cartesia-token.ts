import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

/**
 * Generate a short-lived Cartesia access token for browser-side agent calls.
 *
 * The browser uses this token to connect to the deployed Line agent via WebSocket.
 * Token has `agent` grant only — no TTS/STT access needed (the agent handles those).
 *
 * Architecture Doc Reference: Section 3.3 (Connecting Browser to Line Agent)
 * Cartesia Docs: /line/integrations/web-calls#connection
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit by IP (stricter than TTS — token generation is sensitive)
  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 10,
    keyPrefix: 'cartesia-token-ip',
  });
  if (ipRl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });
  }

  // Require authenticated user
  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.id);

  // Rate limit per user (5 token requests per minute is generous)
  const userRl = checkRateLimit(user.id, {
    windowMs: 60_000,
    maxRequests: 5,
    keyPrefix: 'cartesia-token',
  });
  if (userRl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: userRl.retryAfter });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Cartesia API key not configured' });
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
        expires_in: 600, // 10 minutes — enough for one conversation
        grants: {
          agent: true,
          tts: false,
          stt: false,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        return res.status(500).json({ error: 'Cartesia API key invalid' });
      }
      if (status === 429) {
        return res.status(429).json({ error: 'Cartesia rate limit exceeded' });
      }
      return res.status(502).json({ error: 'Failed to generate access token' });
    }

    const data = (await response.json()) as { token: string };

    return res.status(200).json({
      token: data.token,
      expires_in: 600,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Token request timed out' });
    }
    return res.status(500).json({ error: 'Internal error' });
  }
}
