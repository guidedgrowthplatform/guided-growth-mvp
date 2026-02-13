import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { requestLogger } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';
import pool from './db/pool';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import metricsRoutes from './routes/metrics';
import entriesRoutes from './routes/entries';
import reflectionsRoutes from './routes/reflections';

const app = express();

// Trust proxy (Vercel sits behind a proxy)
app.set('trust proxy', 1);

// CORS
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session — Postgres-backed so it works in serverless
const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.IS_PRODUCTION,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: env.IS_PRODUCTION ? 'none' : 'lax',
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging
app.use(requestLogger);

// Rate limiting for auth
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), database: 'connected' });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/reflections', reflectionsRoutes);

// Affirmation and preferences share the reflections router
app.use('/api', reflectionsRoutes);

// Error handling
app.use(errorHandler);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
