import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.query.token as string;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Decode the session token
    // In production, verify the JWT signature
    const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check expiration
    if (sessionData.exp && sessionData.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Session expired' });
    }

    res.json({
      user: {
        email: sessionData.email,
        name: sessionData.name,
        picture: sessionData.picture,
        id: sessionData.sub,
      },
    });
  } catch (error) {
    console.error('Session decode error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}
