import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from '../_lib/better-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = new URL(req.url!, `https://${req.headers.host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      }
    }

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    const response = await auth.handler(webRequest);

    res.status(response.status);

    const setCookies = response.headers.getSetCookie?.() ?? [];
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return;
      res.setHeader(key, value);
    });
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    const responseBody = await response.text();
    res.send(responseBody);
  } catch (err) {
    console.error('[auth] handler error:', err);
    res.status(500).json({ error: 'Internal server error', message: String(err) });
  }
}
