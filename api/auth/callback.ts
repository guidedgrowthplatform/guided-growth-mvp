import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      return res.redirect('/?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();
    const { access_token, id_token } = tokens;

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.redirect('/?error=user_info_failed');
    }

    const userInfo = await userResponse.json();

    // Create a session token (JWT)
    // In production, use a proper JWT library and sign with a secret
    const sessionToken = Buffer.from(JSON.stringify({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      sub: userInfo.id,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    })).toString('base64');

    // Redirect to frontend with session token
    const frontendUrl = process.env.FRONTEND_URL || 
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    
    res.redirect(`${frontendUrl}/auth/callback?token=${sessionToken}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?error=callback_failed');
  }
}
