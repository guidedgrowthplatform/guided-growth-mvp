import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: require logged-in user to prevent unauthenticated key exposure
  const user = await requireUser(req, res);
  if (!user) return;

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepGram API key not configured' });
  }

  res.status(200).json({ token: apiKey });
}
