import express from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import pool from '../db/index.js'
import logger from '../middleware/logging.js'
import { requireAuth } from '../middleware/auth.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Configure Google OAuth Strategy (only if credentials are available)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value
    const name = profile.displayName
    const avatarUrl = profile.photos[0]?.value

    // Check allowlist
    const allowlistCheck = await pool.query(
      'SELECT id FROM allowlist WHERE email = $1',
      [email]
    )

    if (allowlistCheck.rows.length === 0) {
      logger.warn({ email, message: 'Login attempt from non-allowlisted email' })
      return done(null, false, { message: 'Access denied (not invited)' })
    }

    // Check if user exists
    let userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    let user
    const now = new Date()

    if (userResult.rows.length === 0) {
      // Create new user
      // Check if this is the admin email
      const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user'
      
      const insertResult = await pool.query(
        `INSERT INTO users (email, name, avatar_url, role, last_login_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email, name, avatarUrl, role, now]
      )
      user = insertResult.rows[0]
      logger.info({ userId: user.id, email, message: 'New user created' })
    } else {
      // Update existing user
      user = userResult.rows[0]
      
      // Check if user is disabled
      if (user.status === 'disabled') {
        logger.warn({ userId: user.id, email, message: 'Login attempt from disabled account' })
        return done(null, false, { message: 'Account is disabled' })
      }

      // Update last login and profile info
      await pool.query(
        `UPDATE users 
         SET name = $1, avatar_url = $2, last_login_at = $3, updated_at = $3
         WHERE id = $4`,
        [name, avatarUrl, now, user.id]
      )
      
      // Auto-promote to admin if this is ADMIN_EMAIL and not already admin
      if (email === process.env.ADMIN_EMAIL && user.role !== 'admin') {
        await pool.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['admin', user.id]
        )
        user.role = 'admin'
        logger.info({ userId: user.id, email, message: 'User auto-promoted to admin' })
      }
    }

    return done(null, user)
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack, message: 'OAuth callback error' })
    return done(error, null)
  }
  }))
} else {
  console.warn('⚠️  Google OAuth credentials not configured. OAuth routes will not work.')
}

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return done(null, false)
    }
    done(null, result.rows[0])
  } catch (error) {
    done(error, null)
  }
})

// Auth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=access_denied' }),
  (req, res) => {
    // Successful authentication
    res.redirect(process.env.CORS_ORIGIN || 'http://localhost:5173')
  }
)

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    avatar_url: req.user.avatar_url,
    role: req.user.role,
    status: req.user.status
  })
})

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ message: 'Logged out successfully' })
  })
})

export default router


