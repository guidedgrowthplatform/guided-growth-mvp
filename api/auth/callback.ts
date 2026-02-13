import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db';
import { signToken, setAuthCookie } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const code = req.query.code as string;
    if (!code) return res.redirect('/login?error=no_code');

    // Exchange code for tokens
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

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();
    const email = profile.email;
    if (!email) return res.redirect('/login?error=no_email');

    // Check allowlist
    const allowCheck = await pool.query('SELECT id FROM allowlist WHERE email = $1', [email]);
    if (allowCheck.rows.length === 0) return res.redirect('/login?error=not_invited');

    // Upsert user
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

    // Sign JWT and set cookie
    const token = signToken(user.id);
    res.setHeader('Set-Cookie', setAuthCookie(token));
    res.redirect('/');
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.redirect('/login?error=server_error');
  }
}
