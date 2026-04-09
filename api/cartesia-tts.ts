import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

/**
 * Cartesia Text-to-Speech proxy.
 * POST /api/cartesia-tts
 * Body: { text: string, voice_id?: string }
 * Returns: audio/mpeg stream
 *
 * Replaces ElevenLabs TTS for lower cost and faster latency.
 * Uses Cartesia sonic-3 model via the /tts/bytes endpoint.
 */

// Voice mapping: gender → Cartesia voice ID
// Katie = warm female, Ronald = steady male
const CARTESIA_VOICES: Record<string, string> = {
  // Female voices (stable, agent-style)
  female: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', // Katie
  // Male voices (stable, agent-style)
  male: 'a167e0f3-df7e-4c9d-9e09-98e2e4872788', // Ronald
};

const CARTESIA_API_VERSION = '2026-03-01';

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
    keyPrefix: 'cartesia-tts-ip',
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
      keyPrefix: 'cartesia-tts',
    });
    if (rl.limited)
      return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    // Fall back to ElevenLabs if Cartesia key not configured
    return res.status(500).json({ error: 'Cartesia API key not configured', fallback: true });
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

    // Resolve voice: client can send ElevenLabs voice IDs or gender strings —
    // map them all to Cartesia voice IDs
    let cartesiaVoiceId: string;
    if (voice_id && CARTESIA_VOICES[voice_id]) {
      // Direct gender key match
      cartesiaVoiceId = CARTESIA_VOICES[voice_id];
    } else if (voice_id && Object.values(CARTESIA_VOICES).includes(voice_id)) {
      // Already a Cartesia voice ID
      cartesiaVoiceId = voice_id;
    } else {
      // Default to female (Katie) — same as current ElevenLabs default (Sarah)
      cartesiaVoiceId = CARTESIA_VOICES.female;
    }

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cartesia-Version': CARTESIA_API_VERSION,
      },
      body: JSON.stringify({
        model_id: 'sonic-3',
        transcript: text.trim(),
        voice: {
          mode: 'id',
          id: cartesiaVoiceId,
        },
        output_format: {
          container: 'mp3',
          encoding: 'mp3',
          sample_rate: 24000,
        },
        language: 'en',
        generation_config: {
          speed: 1,
          emotion: 'neutral',
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errData = await response.text().catch(() => '{}');
      console.error('Cartesia TTS error:', response.status, errData);

      if (response.status === 401 || response.status === 429) {
        return res.status(response.status).json({
          error: 'Cartesia quota exceeded or unauthorized',
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
    console.error('Cartesia TTS proxy error:', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'TTS request timed out' });
    }
    return res.status(500).json({ error: 'Internal error processing text-to-speech' });
  }
}
