import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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
        scopes: ['usage:write'],
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
