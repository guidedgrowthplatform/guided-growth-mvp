import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth } from '../_lib/better-auth.js';
import pool from '../_lib/db.js';

const betterAuthHandler = toNodeHandler(auth);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] || '';

  // Skip __index (Vercel rewrite for bare /api/auth)
  if (route === '__index' || segments.length === 0) {
    return res.status(200).json({ ok: true, provider: 'better-auth' });
  }

  // Custom route: GET /api/auth/me — return full user from our users table
  if (route === 'me') {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Look up user in our app's users table
      const result = await pool.query(
        'SELECT id, email, name, avatar_url, role, status FROM users WHERE email = $1',
        [session.user.email],
      );

      if (result.rows.length === 0) {
        // User exists in Better Auth but not in our users table — auto-create
        const now = new Date();
        const email = session.user.email;
        const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
        const insertResult = await pool.query(
          `INSERT INTO users (id, email, name, avatar_url, role, last_login_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6, $6)
           ON CONFLICT (email) DO UPDATE SET last_login_at = $6, updated_at = $6
           RETURNING id, email, name, avatar_url, role, status`,
          [session.user.id, email, session.user.name, session.user.image, role, now],
        );
        return res.json(insertResult.rows[0]);
      }

      return res.json(result.rows[0]);
    } catch (err: unknown) {
      console.error('Auth /me error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // All other routes: delegate to Better Auth handler
  // Reconstruct the full path for Better Auth
  const authPath = `/api/auth/${segments.join('/')}`;
  req.url = authPath + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');

  return betterAuthHandler(req, res);
}
