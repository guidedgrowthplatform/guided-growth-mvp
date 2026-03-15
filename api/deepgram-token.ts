import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error('DeepGram temp key API failed:', response.status);
      return res.status(503).json({ error: 'Failed to generate temporary DeepGram key' });
    }

    const data = await response.json();
    return res.status(200).json({ token: data.api_key || data.key, temporary: true });
  } catch (err) {
    console.error('DeepGram token error:', err);
    return res.status(503).json({ error: 'DeepGram key service unavailable' });
  }
}
