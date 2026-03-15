import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Read the raw body as a Buffer to forward to ElevenLabs
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
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
