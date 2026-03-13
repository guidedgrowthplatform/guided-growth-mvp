// Vercel serverless function — returns DeepGram API key for client-side WebSocket
// Secured: only allows requests from same-origin or known production domains

const ALLOWED_ORIGINS = [
  'https://guided-growth-mvp-six.vercel.app',
  'https://guidedgrowth.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'capacitor://localhost',   // iOS Capacitor
  'http://localhost',        // Android Capacitor
];

export default function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Origin / Referer check — block external callers
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const isAllowed =
    !origin ||  // same-origin requests (no Origin header)
    ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ||
    ALLOWED_ORIGINS.some(o => referer.startsWith(o));

  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepGram API key not configured' });
  }

  // Set CORS headers for allowed origins
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.status(200).json({ token: apiKey });
}
