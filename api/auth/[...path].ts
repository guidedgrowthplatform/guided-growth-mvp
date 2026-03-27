import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from '../_lib/better-auth.js';
import { handlePreflight } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.url!, `${protocol}://${host}`);

    const webReq = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(
        Object.entries(req.headers)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v!]) as [string, string][],
      ),
      body: ['GET', 'HEAD'].includes(req.method!) ? undefined : JSON.stringify(req.body),
    });

    const webRes = await auth.handler(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((value, key) => res.setHeader(key, value));

    const body = await webRes.text();
    if (body) res.send(body);
    else res.end();
  } catch (err) {
    console.error('Auth handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
