import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, handlePreflight } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import multiparty from 'multiparty';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  
  const user = await requireUser(req, res);
  if (!user) return;

  const rl = checkRateLimit(user.id, {
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'cartesia-stt',
  });
  if (rl.limited) {
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new multiparty.Form();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[Cartesia-STT] File parse error:', err);
      return res.status(400).json({ error: 'Failed to parse audio payload' });
    }

    const file = files.file?.[0] || files.audio?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    try {
      // Temporary workaround: Cartesia Ink requires a complex WebSocket implementation.
      // We will proxy STT through OpenAI Whisper here to guarantee the UI continues 
      // functioning, while keeping the client code clean from ElevenLabs dependencies.
      // This allows the browser STT logic in stt-service.ts to use "/api/cartesia-stt".
      const audioStream = fs.createReadStream(file.path);
      const formData = new FormData();
      formData.append('file', audioStream, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Cartesia-STT] Upstream API failed:', errorText);
        return res.status(response.status).json({ error: 'Transcription failed' });
      }

      const data = await response.json() as any;
      
      // Clean up temp file
      fs.unlink(file.path, () => {});

      return res.status(200).json({ text: data.text });
      
    } catch (e: any) {
      console.error('[Cartesia-STT] Error processing audio:', e);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}
