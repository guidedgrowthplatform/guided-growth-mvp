import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight } from './_lib/auth.js';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const SONIOX_BASE = 'https://api.soniox.com/v1';
const STT_TIMEOUT_MS = 15_000;
const POLL_DELAYS_MS = [250, 500, 1000, 2000];
const VOCAB_TERMS = [
  'habit',
  'metric',
  'log',
  'track',
  'streak',
  'reflect',
  'mood',
  'energy',
  'sleep',
  'stress',
  'journal',
  'schedule',
  'remind',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const bypassAuth = process.env.AUTH_BYPASS_MODE === 'true';
  let userId = 'anonymous';

  if (!bypassAuth) {
    const user = await requireUser(req, res);
    if (!user) return;
    userId = user.authUserId;
  }

  const rl = checkRateLimit(userId, {
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'stt',
  });
  if (rl.limited) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SONIOX_API_KEY;
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

    // @ts-expect-error Node fetch + Blob accepts Buffer but TS complains
    const blob = new Blob([fileData], { type: 'audio/wav' });
    const uploadForm = new FormData();
    uploadForm.append('file', blob, 'recording.wav');

    const uploadRes = await fetch(`${SONIOX_BASE}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[STT] Soniox file upload error:', uploadRes.status, errText);
      return res.status(502).json({ error: 'Transcription failed' });
    }
    const { id: fileId } = (await uploadRes.json()) as { id?: string };
    if (!fileId) {
      console.error('[STT] Soniox file upload: no id returned');
      return res.status(502).json({ error: 'Transcription failed' });
    }

    const createRes = await fetch(`${SONIOX_BASE}/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'stt-async-v4',
        language_hints: ['en'],
        file_id: fileId,
        context: { terms: VOCAB_TERMS },
      }),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('[STT] Soniox create error:', createRes.status, errText);
      return res.status(502).json({ error: 'Transcription failed' });
    }
    const { id: jobId } = (await createRes.json()) as { id?: string };
    if (!jobId) {
      console.error('[STT] Soniox create: no id returned');
      // Cleanup uploaded file even though the job never started.
      void fetch(`${SONIOX_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => {});
      return res.status(502).json({ error: 'Transcription failed' });
    }

    // Fire-and-forget cleanup of the Soniox file once we're done with the job.
    const cleanupFile = () => {
      void fetch(`${SONIOX_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => {});
    };

    const deadline = Date.now() + STT_TIMEOUT_MS;
    const PROGRESS_STATUSES = new Set(['pending', 'processing', 'queued']);
    let status = 'pending';
    let attempt = 0;
    while (Date.now() < deadline) {
      const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
      const pollRes = await fetch(`${SONIOX_BASE}/transcriptions/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      // Transient 429/5xx during polling: keep looping until deadline.
      if (pollRes.status === 429 || pollRes.status >= 500) {
        console.warn('[STT] Soniox poll transient:', pollRes.status);
        continue;
      }
      if (!pollRes.ok) {
        console.error('[STT] Soniox poll error:', pollRes.status);
        cleanupFile();
        return res.status(502).json({ error: 'Transcription failed' });
      }
      const pollJson = (await pollRes.json()) as { status?: string; error_message?: string };
      status = pollJson.status || 'pending';
      if (status === 'completed') break;
      // Anything that isn't a known progress state is terminal.
      if (!PROGRESS_STATUSES.has(status)) {
        console.error('[STT] Soniox job non-progress status:', status, pollJson.error_message);
        cleanupFile();
        return res.status(502).json({ error: 'Transcription failed' });
      }
    }

    if (status !== 'completed') {
      cleanupFile();
      return res.status(504).json({ error: 'Transcription timed out' });
    }

    const transcriptRes = await fetch(`${SONIOX_BASE}/transcriptions/${jobId}/transcript`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!transcriptRes.ok) {
      console.error('[STT] Soniox transcript error:', transcriptRes.status);
      cleanupFile();
      return res.status(502).json({ error: 'Transcription failed' });
    }
    const { tokens } = (await transcriptRes.json()) as {
      tokens?: Array<{ text?: string }>;
    };
    const text = (tokens ?? [])
      .map((t) => t.text ?? '')
      .join('')
      .trim();

    cleanupFile();
    return res.status(200).json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[STT] Error:', err);
    return res.status(500).json({ error: msg });
  }
}
