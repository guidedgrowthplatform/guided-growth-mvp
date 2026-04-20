import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setUserContext, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { getClientIp } from './_lib/validation.js';

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB max upload

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always rate-limit by IP regardless of auth mode
  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 15,
    keyPrefix: 'elevenlabs-stt-ip',
  });
  if (ipRl.limited)
    return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });

  // Auth guard — skip only when server-side AUTH_BYPASS_MODE is explicitly set AND not in production
  const bypassAuth =
    process.env.AUTH_BYPASS_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (!bypassAuth) {
    const user = await requireUser(req, res);
    if (!user) return;
    await setUserContext(user.id);
    const rl = checkRateLimit(user.id, {
      windowMs: 60_000,
      maxRequests: 10,
      keyPrefix: 'elevenlabs-stt',
    });
    if (rl.limited)
      return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    // PRIVACY: audio blob is streamed in-memory only, never persisted to disk or logs on this server
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data with WAV file' });
    }

    // Read the raw body as a Buffer to forward to ElevenLabs
    let rawBody: Buffer;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = Buffer.from(req.body, 'utf-8');
    } else {
      // req.body is undefined — read from stream with timeout protection
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      rawBody = await new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Body read timeout'));
        }, 5000);

        req.on('data', (chunk: Buffer | string) => {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk;
          totalBytes += buf.length;
          if (totalBytes > MAX_BODY_BYTES) {
            clearTimeout(timeout);
            req.removeAllListeners();
            reject(new Error('File too large'));
            return;
          }
          chunks.push(buf);
        });

        req.on('end', () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks));
        });

        req.on('error', reject);

        // Ensure stream starts flowing
        if (req.readableFlowing === false) {
          req.resume();
        }
      });
    }

    if (rawBody.length === 0) {
      return res.status(400).json({ error: 'Request body is empty' });
    }

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': contentType,
      },
      body: new Uint8Array(rawBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('ElevenLabs STT error:', response.status, errData);
      return res.status(502).json({ error: 'Speech-to-text service error. Please try again.' });
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
