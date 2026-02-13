import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/src/app.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel catch-all at /api/[...path] means req.url is /api/...
  // But we also rewrite /auth/* -> /api/auth/* in vercel.json
  // Express app expects /auth/*, /api/*, /health
  // So strip the leading /api prefix that Vercel adds
  if (req.url?.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }
  return app(req, res);
}
