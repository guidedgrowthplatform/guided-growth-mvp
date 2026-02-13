import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie } from '../_lib/auth';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Set-Cookie', clearAuthCookie());
  res.json({ message: 'Logged out' });
}
