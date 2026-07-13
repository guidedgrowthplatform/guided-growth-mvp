import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, requireUser } from '../_lib/auth.js';
import {
  buildConsentUrl,
  createOAuthNonce,
  isValidScheme,
  type OAuthPlatform,
} from '../_lib/calendar/oauth.js';

// POST — mint a single-use nonce, return the Google consent URL. Decoupled from
// login: the token returns to /oauth-callback, so the session is never touched.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const platform = body.platform;
  if (platform !== 'web' && platform !== 'native') {
    return res.status(400).json({ error: "platform must be 'web' or 'native'" });
  }
  let scheme: string | null = null;
  if (platform === 'native') {
    if (!isValidScheme(body.scheme)) return res.status(400).json({ error: 'invalid scheme' });
    scheme = body.scheme;
  }
  const nonce = await createOAuthNonce(user.anonId, platform as OAuthPlatform, scheme);
  return res.status(200).json({ url: buildConsentUrl(nonce) });
}
