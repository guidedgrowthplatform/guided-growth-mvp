import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight } from './_lib/auth.js';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

type SttProvider = 'cartesia' | 'deepgram';

async function transcribeWithCartesia(params: {
  apiKey: string;
  fileData: Buffer;
  filename: string;
  language: string;
  model: string;
}): Promise<{ text: string }> {
  const { apiKey, fileData, filename, language, model } = params;

  // @ts-expect-error Node fetch + Blob accepts Buffer but TS complains
  const blob = new Blob([fileData], { type: 'audio/wav' });
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('model', model);
  fd.append('language', language);

  const sttRes = await fetch('https://api.cartesia.ai/stt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Cartesia-Version': '2026-03-01',
    },
    body: fd,
    signal: AbortSignal.timeout(15000),
  });

  if (!sttRes.ok) {
    const errText = await sttRes.text().catch(() => '');
    console.error('[STT] Cartesia error:', sttRes.status, errText);
    throw new Error(`Cartesia STT failed (${sttRes.status})`);
  }

  const json = (await sttRes.json()) as { text?: string };
  return { text: json.text || '' };
}

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

  const provider = (process.env.STT_PROVIDER || 'cartesia') as SttProvider;
  if (provider !== 'cartesia' && provider !== 'deepgram') {
    return res.status(500).json({ error: 'Invalid STT_PROVIDER' });
  }

  const cartesiaKey = process.env.CARTESIA_API_KEY;
  if (!cartesiaKey && provider === 'cartesia') {
    return res.status(500).json({ error: 'Cartesia STT not configured' });
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
    let filename = 'audio.wav';

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
            const fnMatch = hdr.match(/filename="([^"]+)"/);
            if (fnMatch) filename = fnMatch[1];

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

    if (provider === 'deepgram') {
      // Phase 3: custom voice stack reintroduces Deepgram STT.
      return res.status(501).json({ error: 'Deepgram STT disabled in MVP (Phase 3)' });
    }

    const language = process.env.CARTESIA_STT_LANGUAGE || 'en';
    const model = process.env.CARTESIA_STT_MODEL || 'ink-whisper';

    const { text } = await transcribeWithCartesia({
      apiKey: cartesiaKey!,
      fileData,
      filename,
      language,
      model,
    });

    return res.status(200).json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[STT] Error:', err);
    return res.status(500).json({ error: msg });
  }
}
