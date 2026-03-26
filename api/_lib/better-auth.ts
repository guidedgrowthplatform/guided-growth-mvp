import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET environment variable is required');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const capacitorOrigins = ['capacitor://localhost', 'http://localhost'];

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,

  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : undefined,
    ...capacitorOrigins,
  ].filter(Boolean) as string[],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
      status: { type: 'string', defaultValue: 'active', input: false },
      last_login_at: { type: 'string', required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const result = await pool.query('SELECT id FROM allowlist WHERE email = $1', [
            user.email,
          ]);
          if (result.rows.length === 0) return false;
          const role = user.email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
          return { data: { ...user, role, status: 'active' } };
        },
      },
    },
  },

  advanced: {
    useSecureCookies: process.env.BETTER_AUTH_SECURE_COOKIES === 'true',
    defaultCookieAttributes: {
      sameSite: 'none' as const,
      secure: true,
    },
  },
});
