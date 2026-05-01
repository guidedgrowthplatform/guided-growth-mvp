import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight } from './_lib/auth.js';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const bypassAuth = process.env.AUTH_BYPASS_MODE === 'true';
  let userId = 'anonymous';

  if (!bypassAuth) {
    const user = await requireUser(req, res);
    if (!user) return;
    userId = user.id;
  }

  const rl = checkRateLimit(userId, {
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'cartesia-stt',
  });
  if (rl.limited) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'STT API not configured' });
  }

  try {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const body = Buffer.concat(chunks);

    if (body.length === 0) {
      return res.status(400).json({ error: 'Empty body' });
    }

    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!bm) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    const boundary = bm[1] || bm[2];
    const sep = Buffer.from('--' + boundary);
    let fileData: Buffer | null = null;

    let cursor = 0;
    while (true) {
      const idx = body.indexOf(sep, cursor);
      if (idx === -1) break;
      const nextBound = body.indexOf(sep, idx + sep.length);
      if (nextBound !== -1) {
        const part = body.subarray(idx + sep.length, nextBound);
        const hdrEnd = part.indexOf('\r\n\r\n');
        if (hdrEnd !== -1) {
          const hdr = part.subarray(0, hdrEnd).toString('utf-8');
          if (hdr.includes('filename=')) {
            // Find end of data before the next \r\n boundary padding
            let dataEnd = part.length;
            if (part[dataEnd - 2] === 0x0d && part[dataEnd - 1] === 0x0a) {
              dataEnd -= 2;
            }
            fileData = Buffer.from(part.subarray(hdrEnd + 4, dataEnd));
            break;
          }
        }
      }
      cursor = idx + sep.length;
    }

    if (!fileData || fileData.length === 0) {
      return res.status(400).json({ error: 'No audio file found' });
    }

    // Build FormData for OpenAI Whisper (Node 18+)
    // Disable TS checking for standard web APIs that conflict with Buffer
    // @ts-expect-error Node fetch + Blob perfectly accepts Buffer but TS complains
    const blob = new Blob([fileData], { type: 'audio/wav' });
    const fd = new FormData();
    fd.append('file', blob, 'recording.wav');
    fd.append('model', 'whisper-1');
    fd.append('language', 'en');
    fd.append(
      'prompt',
      'habit, metric, log, track, streak, reflect, mark, done, complete, schedule, remind, journal, weekday, weekend, sleep, mood, energy, stress',
    );

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[STT] Whisper error:', whisperRes.status, errText);
      return res.status(whisperRes.status).json({ error: 'Transcription failed' });
    }

    const { text } = (await whisperRes.json()) as { text?: string };
    return res.status(200).json({ text: text || '' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[STT] Error:', err);
    return res.status(500).json({ error: msg });
  }
}
