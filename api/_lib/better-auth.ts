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
  ssl: process.env.SUPABASE_SSL_CERT
    ? { ca: process.env.SUPABASE_SSL_CERT, rejectUnauthorized: true }
    : { rejectUnauthorized: false },
  max: 1,
});

// Capacitor WebView origins that need auth access.
// iOS: capacitor://localhost, Android: http://localhost
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
  advanced: {
    // Capacitor Android loads from http://localhost which is NOT a secure
    // context. Browsers reject cookies with the __Secure- prefix unless the
    // connection is HTTPS. By setting useSecureCookies to false, Better Auth
    // will omit the __Secure- prefix and the secure flag, allowing cookies
    // to be stored in Capacitor WebViews.
    //
    // This is safe because the Vercel API is still served over HTTPS — the
    // "insecure" cookies only affect the name/prefix, not the transport.
    // In production with only browser clients you may set this to true via
    // an environment variable.
    useSecureCookies: process.env.BETTER_AUTH_SECURE_COOKIES === 'true',
    defaultCookieAttributes: {
      sameSite: 'none' as const,
      // secure must be true when sameSite=none, even though the cookie name
      // won't carry the __Secure- prefix. This lets the browser accept the
      // cookie on cross-origin requests from Capacitor → Vercel.
      secure: true,
    },
  },
});
