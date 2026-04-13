import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

// Katie (female) — same voice used for MP3 generation
const DEFAULT_VOICE_ID = 'f786b574-daa5-4673-aa0c-cbe3e8534c02';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'cartesia-tts-ip',
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
      maxRequests: 20,
      keyPrefix: 'cartesia-tts',
    });
    if (rl.limited)
      return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Cartesia API key not configured', fallback: true });
  }

  try {
    const { text, voice_id } = req.body as { text?: string; voice_id?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "text" field' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: 'Text too long (max 1000 characters)' });
    }

    // Use client-provided voice_id if it looks like a Cartesia ID, else default
    const resolvedVoiceId =
      voice_id && /^[0-9a-f-]{36}$/.test(voice_id) ? voice_id : DEFAULT_VOICE_ID;

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cartesia-Version': '2026-03-01',
      },
      body: JSON.stringify({
        model_id: 'sonic-3',
        transcript: text.trim(),
        voice: { mode: 'id', id: resolvedVoiceId },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 24000 },
        language: 'en',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errStatus = response.status;
      if (errStatus === 401 || errStatus === 429) {
        return res
          .status(errStatus)
          .json({ error: 'Cartesia quota exceeded or unauthorized', fallback: true });
      }
      return res.status(502).json({ error: 'Text-to-speech service error', fallback: true });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'TTS request timed out', fallback: true });
    }
    return res.status(500).json({ error: 'Internal error', fallback: true });
  }
}
