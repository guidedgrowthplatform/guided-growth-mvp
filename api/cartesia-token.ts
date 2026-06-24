import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserNoDb, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

const CARTESIA_TOKEN_URL = 'https://api.cartesia.ai/access-token';
const CARTESIA_VERSION = '2026-03-01';
const MINT_TIMEOUT_MS = 10_000;
// Short-lived: client warm-loop re-mints under this window.
const EXPIRES_IN_SECONDS = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bypassAuth =
    process.env.AUTH_BYPASS_MODE === 'true' && process.env.NODE_ENV !== 'production';
  let rateLimitKey = 'anonymous';
  if (!bypassAuth) {
    const user = await requireUserNoDb(req, res);
    if (!user) return;
    rateLimitKey = user.authUserId;
  }

  const rl = checkRateLimit(rateLimitKey, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'cartesia-token',
  });
  if (rl.limited) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TTS not configured' });
  }

  try {
    const resp = await fetch(CARTESIA_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cartesia-Version': CARTESIA_VERSION,
      },
      body: JSON.stringify({
        grants: { tts: true },
        expires_in: EXPIRES_IN_SECONDS,
      }),
      signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
    });

    if (!resp.ok) {
      console.error('[cartesia-token]', resp.status, await resp.text().catch(() => ''));
      return res.status(502).json({ error: 'TTS token failed' });
    }

    const data = (await resp.json()) as { token?: string; access_token?: string };
    const token = data.token ?? data.access_token;
    if (!token) {
      console.error('[cartesia-token] mint ok but no token in response');
      return res.status(502).json({ error: 'TTS token failed' });
    }
    return res.status(200).json({ accessToken: token, expiresIn: EXPIRES_IN_SECONDS });
  } catch (err) {
    console.error('[cartesia-token] Error:', err);
    return res.status(502).json({ error: 'TTS token failed' });
  }
}
