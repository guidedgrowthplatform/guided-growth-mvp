import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { signToken, setAuthCookie, clearAuthCookie, getUser } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] || '';

  // GET /api/auth/google
  if (route === 'google') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: process.env.GOOGLE_CALLBACK_URL || '',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // GET /api/auth/callback
  if (route === 'callback') {
    try {
      const code = req.query.code as string;
      if (!code) return res.redirect('/login?error=no_code');

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: process.env.GOOGLE_CALLBACK_URL || '',
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) return res.redirect('/login?error=token_failed');

      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await userRes.json();
      const email = profile.email;
      if (!email) return res.redirect('/login?error=no_email');

      const allowCheck = await pool.query('SELECT id FROM allowlist WHERE email = $1', [email]);
      if (allowCheck.rows.length === 0) return res.redirect('/login?error=not_invited');

      const now = new Date();
      const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

      let user;
      if (existing.rows.length === 0) {
        const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
        const result = await pool.query(
          `INSERT INTO users (email, name, avatar_url, role, last_login_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [email, profile.name, profile.picture, role, now]
        );
        user = result.rows[0];
      } else {
        user = existing.rows[0];
        if (user.status === 'disabled') return res.redirect('/login?error=disabled');
        await pool.query(
          `UPDATE users SET name = $1, avatar_url = $2, last_login_at = $3, updated_at = $3 WHERE id = $4`,
          [profile.name, profile.picture, now, user.id]
        );
      }

      const token = signToken(user.id);
      res.setHeader('Set-Cookie', setAuthCookie(token));
      return res.redirect('/');
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      return res.redirect('/login?error=server_error');
    }
  }

  // GET /api/auth/me
  if (route === 'me') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({
      id: user.id, email: user.email, name: user.name,
      avatar_url: user.avatar_url, role: user.role, status: user.status,
    });
  }

  // POST /api/auth/logout
  if (route === 'logout') {
    res.setHeader('Set-Cookie', clearAuthCookie());
    return res.json({ message: 'Logged out' });
  }

  res.status(404).json({ error: 'Not found' });
}
