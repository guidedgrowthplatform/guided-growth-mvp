// Vercel serverless function — returns DeepGram API key for client-side WebSocket
// This keeps the key server-side and could implement rate limiting

export default function handler(req, res) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepGram API key not configured' });
  }
  
  // In production, add rate limiting, auth checks, etc.
  res.status(200).json({ token: apiKey });
}
