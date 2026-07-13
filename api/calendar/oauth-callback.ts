import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight } from '../_lib/auth.js';
import { exchangeCodeForTokens } from '../_lib/calendar/google.js';
import {
  calendarRedirectUri,
  consumeOAuthNonce,
  hasRequiredScopes,
  oauthReturnUrl,
  persistCalendarGrant,
  type OAuthStateRow,
} from '../_lib/calendar/oauth.js';

// GET — PUBLIC top-level redirect from Google (no auth header). Consume the
// single-use nonce, exchange the code, store the token under the bound anon_id.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const q = req.query as Record<string, string | string[] | undefined>;
  const state = typeof q.state === 'string' ? q.state : '';
  const code = typeof q.code === 'string' ? q.code : '';
  const googleError = typeof q.error === 'string' ? q.error : '';

  const row = await consumeOAuthNonce(state);
  if (!row) return redirect(res, null, false);
  if (googleError || !code) return redirect(res, row, false);

  try {
    const tokens = await exchangeCodeForTokens(code, calendarRedirectUri());
    const refreshToken = tokens.refresh_token;
    if (typeof refreshToken !== 'string' || refreshToken.length < 10) {
      console.warn('[calendar] oauth callback: no refresh token in exchange');
      return redirect(res, row, false);
    }
    if (!hasRequiredScopes(tokens.scope)) {
      console.warn('[calendar] oauth callback: missing required scopes', tokens.scope);
      return redirect(res, row, false);
    }
    await persistCalendarGrant(row.anonId, refreshToken, tokens.scope ?? null);
    return redirect(res, row, true);
  } catch (err) {
    console.error('[calendar] oauth callback exchange failed', err);
    return redirect(res, row, false);
  }
}

function redirect(res: VercelResponse, row: OAuthStateRow | null, ok: boolean) {
  res.setHeader('Location', oauthReturnUrl(row, ok));
  return res.status(302).end();
}
