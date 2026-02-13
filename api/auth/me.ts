import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    id: user.id, email: user.email, name: user.name,
    avatar_url: user.avatar_url, role: user.role, status: user.status,
  });
}
