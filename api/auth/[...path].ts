import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from '../_lib/better-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = new URL(req.url!, `https://${req.headers.host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const response = await auth.handler(webRequest);

    res.status(response.status);

    // Forward all headers, handling multiple Set-Cookie correctly
    const setCookies = response.headers.getSetCookie?.() ?? [];
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return; // handle separately
      res.setHeader(key, value);
    });
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    const body = await response.text();
    res.send(body);
  } catch (err) {
    console.error('[auth] handler error:', err);
    res.status(500).json({ error: 'Internal server error', message: String(err) });
  }
}
