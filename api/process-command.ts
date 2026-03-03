import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VOICE_COMMAND_SYSTEM_PROMPT, VOICE_COMMAND_MODEL_CONFIG } from '../src/lib/prompts/voice-command-system';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { transcript } = req.body;
  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Missing transcript' });
  }

  try {
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...VOICE_COMMAND_MODEL_CONFIG,
        messages: [
          { role: 'system', content: VOICE_COMMAND_SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText);
      return res.status(502).json({ error: `OpenAI API error: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'Empty response from GPT' });
    }

    const parsed = JSON.parse(content);
    const latency = Date.now() - startTime;

    return res.status(200).json({
      ...parsed,
      latency,
      model: 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('Process command error:', err);
    return res.status(500).json({
      error: `Server error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
