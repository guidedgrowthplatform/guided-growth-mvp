import type { VercelRequest, VercelResponse } from '@vercel/node';

// IMPORTANT — Capacitor uses different origins per platform:
//   - iOS WKWebView (capacitor.config.ts iosScheme='capacitor'): capacitor://localhost
//   - Android WebView (Capacitor 3+ default scheme): https://localhost
// Both must be in this list or fetch() from the native app fails CORS
// preflight. Missing https://localhost was the root cause of Timothy's
// "Could not connect to server" report on the Android APK in early Apr 2026.
const ALLOWED_ORIGINS = [
  'https://guided-growth-mvp.vercel.app',
  'capacitor://localhost', // iOS WKWebView
  'https://localhost', // Android Capacitor 3+ default
  'http://localhost', // legacy / dev fallback
  'http://localhost:5173', // Vite dev server
];

// Returns true if OPTIONS preflight was handled
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin || '';
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

  // Allow Vercel preview deployments (the URL is dynamic per branch).
  const isVercelPreview = /^https:\/\/[a-z0-9-]+-guided-growth-mvp.*\.vercel\.app$/.test(origin);

  if (
    ALLOWED_ORIGINS.includes(origin) ||
    (vercelOrigin && origin === vercelOrigin) ||
    isVercelPreview
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Cache preflight for 1 hour to cut latency on subsequent requests.
    res.setHeader('Access-Control-Max-Age', '3600');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
