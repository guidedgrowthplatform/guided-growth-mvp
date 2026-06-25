import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

// Coach Yair cloned voice: "Yair English, Pro Voice Clone, V1". Must match the
// Vapi assistant voice exactly so the onboarding opener hands off seamlessly.
const DEFAULT_VOICE_ID = '104635f9-8991-403c-9988-bc5b70b39939';

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
    await setUserContext(user.authUserId);
    const rl = checkRateLimit(user.authUserId, {
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
    const { text, voice_id, format } = req.body as {
      text?: string;
      voice_id?: string;
      format?: string;
    };

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
        model_id: 'sonic-3.5-2026-05-04',
        transcript: text.trim(),
        voice: { mode: 'id', id: resolvedVoiceId },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 24000 },
        language: 'en',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errStatus = response.status;
      // Read the error body so we can see *why* Cartesia rejected us —
      // previously we swallowed this and every failure surfaced as an
      // opaque 502, making it impossible to distinguish "bad voice_id"
      // from "expired API key" from "model deprecated" (Alejandro's
      // 2026-04-25 demo — kept hearing the browser fallback voice).
      const errBody = await response.text().catch(() => '');
      console.error('[cartesia-tts] upstream error', {
        status: errStatus,
        body: errBody.slice(0, 500),
        voice_id: resolvedVoiceId,
      });
      if (errStatus === 401 || errStatus === 429) {
        return res
          .status(errStatus)
          .json({ error: 'Cartesia quota exceeded or unauthorized', fallback: true });
      }
      return res.status(502).json({
        error: 'Text-to-speech service error',
        upstream_status: errStatus,
        upstream_detail: errBody.slice(0, 200),
        fallback: true,
      });
    }

    const audioBuffer = await response.arrayBuffer();
    // base64 lane: CapacitorHttp's patched fetch corrupts binary bodies on native
    if (format === 'base64') {
      return res.status(200).json({ audio: Buffer.from(audioBuffer).toString('base64') });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'TTS request timed out', fallback: true });
    }
    return res.status(500).json({ error: 'Internal error', fallback: true });
  }
}
