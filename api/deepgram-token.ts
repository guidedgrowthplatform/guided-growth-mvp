import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always rate-limit by IP regardless of auth mode
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const ipRl = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 15, keyPrefix: 'deepgram-token-ip' });
  if (ipRl.limited) return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });

  // Auth guard — skip only when server-side AUTH_BYPASS_MODE is explicitly set
  if (process.env.AUTH_BYPASS_MODE !== 'true') {
    const user = await requireUser(req, res);
    if (!user) return;
    const rl = checkRateLimit(user.id, { windowMs: 60_000, maxRequests: 10, keyPrefix: 'deepgram-token' });
    if (rl.limited) return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DeepGram API key not configured' });
  }

  // Request a temporary scoped key from DeepGram (60 second TTL)
  try {
    const authHeaders = {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Get project ID (required for key creation endpoint)
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: authHeaders,
      signal: AbortSignal.timeout(5000),
    });

    if (!projectsRes.ok) {
      console.error('DeepGram projects API failed:', projectsRes.status);
      return res.status(503).json({ error: 'Failed to fetch DeepGram project' });
    }

    const projectsData = await projectsRes.json();
    const projectId = projectsData.projects?.[0]?.project_id;
    if (!projectId) {
      console.error('No DeepGram project found');
      return res.status(503).json({ error: 'No DeepGram project found' });
    }

    // Step 2: Create temporary key scoped to the project
    const response = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        comment: 'temp-client-key',
        scopes: ['usage:write', 'usage:read'],
        time_to_live_in_seconds: 60,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error('DeepGram temp key API failed:', response.status);
      return res.status(503).json({ error: 'Failed to generate temporary DeepGram key' });
    }

    const data = await response.json();
    return res.status(200).json({ token: data.api_key || data.key, temporary: true });
  } catch (err) {
    console.error('DeepGram token error:', err);
    return res.status(503).json({ error: 'DeepGram key service unavailable' });
  }
}
