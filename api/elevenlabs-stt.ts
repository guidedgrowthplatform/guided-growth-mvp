import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB max upload

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always rate-limit by IP regardless of auth mode
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const ipRl = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 15, keyPrefix: 'elevenlabs-stt-ip' });
  if (ipRl.limited) return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });

  // Auth guard — skip only when server-side AUTH_BYPASS_MODE is explicitly set
  if (process.env.AUTH_BYPASS_MODE !== 'true') {
    const user = await requireUser(req, res);
    if (!user) return;
    const rl = checkRateLimit(user.id, { windowMs: 60_000, maxRequests: 10, keyPrefix: 'elevenlabs-stt' });
    if (rl.limited) return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    // The request body is multipart/form-data with the WAV blob.
    // Vercel parses the raw body — forward it to ElevenLabs.
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data with WAV file' });
    }

    // Read the raw body as a Buffer to forward to ElevenLabs (with size limit)
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'Audio file too large (max 10MB)' });
      }
      chunks.push(buf);
    }
    const rawBody = Buffer.concat(chunks);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': contentType,
      },
      body: rawBody,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const detail = (errData as Record<string, unknown>).detail || `ElevenLabs API error: ${response.status}`;
      return res.status(502).json({ error: detail });
    }

    const data = await response.json();
    return res.status(200).json({ text: (data as Record<string, unknown>).text || '' });
  } catch (err) {
    console.error('ElevenLabs STT proxy error:', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'ElevenLabs API request timed out' });
    }
    return res.status(500).json({ error: 'Internal error processing speech-to-text' });
  }
}
