import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

/**
 * ElevenLabs Text-to-Speech proxy.
 * POST /api/elevenlabs-tts
 * Body: { text: string, voice_id?: string }
 * Returns: audio/mpeg stream
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit by IP
  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'elevenlabs-tts-ip',
  });
  if (ipRl.limited)
    return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });

  // Auth guard
  const bypassAuth =
    process.env.AUTH_BYPASS_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (!bypassAuth) {
    const user = await requireUser(req, res);
    if (!user) return;
    await setUserContext(user.id);
    const rl = checkRateLimit(user.id, {
      windowMs: 60_000,
      maxRequests: 20,
      keyPrefix: 'elevenlabs-tts',
    });
    if (rl.limited)
      return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const { text, voice_id } = req.body as { text?: string; voice_id?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "text" field' });
    }

    // Cap text length to prevent abuse
    if (text.length > 1000) {
      return res.status(400).json({ error: 'Text too long (max 1000 characters)' });
    }

    // Default to a natural-sounding voice; can be overridden by the client
    const selectedVoiceId = voice_id || process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" — natural female voice

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('ElevenLabs TTS error:', response.status, errData);

      // If quota exceeded, tell the client to fall back to browser TTS
      if (response.status === 401 || response.status === 429) {
        return res.status(response.status).json({
          error: 'ElevenLabs quota exceeded or unauthorized',
          fallback: true,
        });
      }
      return res.status(502).json({ error: 'Text-to-speech service error' });
    }

    // Stream the audio back to the client
    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('ElevenLabs TTS proxy error:', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'TTS request timed out' });
    }
    return res.status(500).json({ error: 'Internal error processing text-to-speech' });
  }
}
