import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  // Rate limit: 10 token requests per minute per user
  const rl = checkRateLimit(user.id, { windowMs: 60_000, maxRequests: 10, keyPrefix: 'deepgram-token' });
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests. Try again later.', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepGram API key not configured' });
  }

  // Request a temporary scoped key from DeepGram (60 second TTL)
  try {
    const response = await fetch('https://api.deepgram.com/v1/keys/temporary', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        time_to_live_in_seconds: 60,
        scopes: ['usage:write'],
      }),
    });

    if (!response.ok) {
      // Fallback: if temp key API fails (e.g., plan doesn't support it),
      // return a warning but still provide the key for backward compat
      console.error('DeepGram temp key API failed:', response.status);
      return res.status(200).json({ token: apiKey, temporary: false });
    }

    const data = await response.json();
    return res.status(200).json({ token: data.api_key || data.key, temporary: true });
  } catch (err) {
    console.error('DeepGram token error:', err);
    // Fallback to raw key if temp key request fails
    return res.status(200).json({ token: apiKey, temporary: false });
  }
}
