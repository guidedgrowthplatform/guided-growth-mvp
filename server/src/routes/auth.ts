import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from '../db/pool.js';
import logger from '../middleware/logging.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = Router();

// Configure Google OAuth Strategy
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(null, false, { message: 'No email in profile' });

          const name = profile.displayName;
          const avatarUrl = profile.photos?.[0]?.value;

          // Check allowlist
          const allowlistCheck = await pool.query(
            'SELECT id FROM allowlist WHERE email = $1',
            [email]
          );

          if (allowlistCheck.rows.length === 0) {
            logger.warn({ email, message: 'Login attempt from non-allowlisted email' });
            return done(null, false, { message: 'Access denied (not invited)' });
          }

          // Check if user exists
          const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
          const now = new Date();

          let user;
          if (userResult.rows.length === 0) {
            const role = email === env.ADMIN_EMAIL ? 'admin' : 'user';
            const insertResult = await pool.query(
              `INSERT INTO users (email, name, avatar_url, role, last_login_at)
               VALUES ($1, $2, $3, $4, $5) RETURNING *`,
              [email, name, avatarUrl, role, now]
            );
            user = insertResult.rows[0];
            logger.info({ userId: user.id, email, message: 'New user created' });
          } else {
            user = userResult.rows[0];
            if (user.status === 'disabled') {
              logger.warn({ userId: user.id, email, message: 'Login attempt from disabled account' });
              return done(null, false, { message: 'Account is disabled' });
            }

            await pool.query(
              `UPDATE users SET name = $1, avatar_url = $2, last_login_at = $3, updated_at = $3
               WHERE id = $4`,
              [name, avatarUrl, now, user.id]
            );

            if (email === env.ADMIN_EMAIL && user.role !== 'admin') {
              await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', user.id]);
              user.role = 'admin';
              logger.info({ userId: user.id, email, message: 'User auto-promoted to admin' });
            }
          }

          return done(null, user);
        } catch (error: any) {
          logger.error({ error: error.message, stack: error.stack, message: 'OAuth callback error' });
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth credentials not configured. OAuth routes will not work.');
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return done(null, false);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=access_denied' }),
  (_req, res) => {
    res.redirect(env.CORS_ORIGIN);
  }
);

router.get('/me', requireAuth, (req, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    avatar_url: u.avatar_url,
    role: u.role,
    status: u.status,
  });
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
