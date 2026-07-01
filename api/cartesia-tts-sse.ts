import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

// Match the scripted mp3 path (api/cartesia-tts.ts) — same voice + model so
// scripted and dynamic lines sound identical.
const DEFAULT_VOICE_ID = '104635f9-8991-403c-9988-bc5b70b39939';
const MODEL_ID = 'sonic-3.5-2026-05-04';

// SSE forces raw PCM; s16le @ 24k is the client's decode contract (cartesiaVoice.ts).
const SAMPLE_RATE = 24000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'cartesia-sse-ip',
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
      keyPrefix: 'cartesia-sse',
    });
    if (rl.limited)
      return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Cartesia API key not configured', fallback: true });
  }

  const { text, voice_id } = req.body as { text?: string; voice_id?: string };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty "text" field' });
  }
  if (text.length > 1000) {
    return res.status(400).json({ error: 'Text too long (max 1000 characters)' });
  }

  const resolvedVoiceId =
    voice_id && /^[0-9a-f-]{36}$/.test(voice_id) ? voice_id : DEFAULT_VOICE_ID;

  let upstream: Response;
  try {
    upstream = await fetch('https://api.cartesia.ai/tts/sse', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cartesia-Version': '2026-03-01',
      },
      body: JSON.stringify({
        model_id: MODEL_ID,
        transcript: text.trim(),
        voice: { mode: 'id', id: resolvedVoiceId },
        output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SAMPLE_RATE },
        add_timestamps: true,
        language: 'en',
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'TTS request timed out', fallback: true });
    }
    return res.status(502).json({ error: 'Text-to-speech service error', fallback: true });
  }

  if (!upstream.ok || !upstream.body) {
    const errBody = await upstream.text().catch(() => '');
    console.error('[cartesia-sse] upstream error', {
      status: upstream.status,
      body: errBody.slice(0, 500),
      voice_id: resolvedVoiceId,
    });
    const status = upstream.status === 401 || upstream.status === 429 ? upstream.status : 502;
    return res.status(status).json({
      error: 'Text-to-speech service error',
      upstream_status: upstream.status,
      fallback: true,
    });
  }

  // Pipe Cartesia's SSE stream straight through; the client parses chunk /
  // timestamps / done events (cartesiaVoice.ts).
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } catch (err) {
    console.error('[cartesia-sse] stream relay error', err);
  } finally {
    res.end();
  }
}
