import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserNoDb, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

const SONIOX_TEMP_KEY_URL = 'https://api.soniox.com/v1/auth/temporary-api-key';
const MINT_TIMEOUT_MS = 10_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bypassAuth =
    process.env.AUTH_BYPASS_MODE === 'true' && process.env.NODE_ENV !== 'production';
  // server-side rate-limit key only; never sent to Soniox (anonymization)
  let rateLimitKey = 'anonymous';
  if (!bypassAuth) {
    const user = await requireUserNoDb(req, res);
    if (!user) return;
    rateLimitKey = user.authUserId;
  }

  const rl = checkRateLimit(rateLimitKey, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'soniox-temp-key',
  });
  if (rl.limited) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'STT not configured' });
  }

  try {
    const resp = await fetch(SONIOX_TEMP_KEY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usage_type: 'transcribe_websocket',
        expires_in_seconds: 300,
        single_use: true,
        max_session_duration_seconds: 3600,
      }),
      signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
    });

    if (!resp.ok) {
      // Never echo Soniox body to client
      console.error('[soniox-temp-key]', resp.status, await resp.text());
      return res.status(502).json({ error: 'STT temp key failed' });
    }

    const data = (await resp.json()) as { api_key?: string; expires_at?: string };
    if (!data.api_key) {
      console.error('[soniox-temp-key] mint ok but no api_key in response');
      return res.status(502).json({ error: 'STT temp key failed' });
    }
    return res.status(200).json({ apiKey: data.api_key, expiresAt: data.expires_at });
  } catch (err) {
    console.error('[soniox-temp-key] Error:', err);
    return res.status(502).json({ error: 'STT temp key failed' });
  }
}
