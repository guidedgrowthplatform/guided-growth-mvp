import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are a voice command processor for a Life Tracker app. Parse user voice transcripts into structured JSON commands.

Available actions: create, complete, delete, update, query, log, reflect, suggest
Available entities: habit, metric, journal, summary

Parse rules:
1. Extract the action, entity, and relevant parameters
2. Use "today" as default date if none specified
3. For numbers in speech, convert to numeric values
4. Handle casual/conversational input gracefully
5. Day names (monday, tuesday) = most recent past occurrence
6. "how am I doing" / "how's my X" = query action
7. "I feel" / "I slept" / reflective statements = reflect action
8. "suggest" / "recommend" = suggest action
9. "show" / "list" / "what are" = query action
10. "mark X done" / "completed X" = complete action
11. "log X as Y" / "record X Y" = log action (for metrics)
12. "rename X to Y" = update action with newName param
13. Return confidence 0.0-1.0 based on how clear the intent is
14. NEVER return "unknown" unless the input is complete nonsense

Response format (JSON only, no markdown):
{
  "action": "create|complete|delete|update|query|log|reflect|suggest",
  "entity": "habit|metric|journal|summary",
  "params": { ... },
  "confidence": 0.85
}

Examples:
- "create a habit called meditation" → {"action":"create","entity":"habit","params":{"name":"meditation"},"confidence":0.95}
- "mark exercise done" → {"action":"complete","entity":"habit","params":{"name":"exercise","date":"today"},"confidence":0.9}
- "log sleep quality as 8 out of 10" → {"action":"log","entity":"metric","params":{"name":"sleep quality","value":8},"confidence":0.9}
- "how am I doing with meditation this week?" → {"action":"query","entity":"habit","params":{"name":"meditation","period":"week"},"confidence":0.85}
- "I slept terribly" → {"action":"reflect","entity":"journal","params":{"mood":"low","themes":["sleep"]},"confidence":0.8}
- "what's my longest streak?" → {"action":"query","entity":"habit","params":{"metric":"streak","sort":"longest"},"confidence":0.85}
- "give me a weekly summary" → {"action":"query","entity":"summary","params":{"period":"week"},"confidence":0.9}
- "add a metric for mood scale 1 to 10" → {"action":"create","entity":"metric","params":{"name":"mood","inputType":"scale","scale":[1,10]},"confidence":0.9}
- "rename exercise to morning workout" → {"action":"update","entity":"habit","params":{"name":"exercise","newName":"morning workout"},"confidence":0.9}
- "suggest a habit" → {"action":"suggest","entity":"habit","params":{},"confidence":0.9}`;

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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
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
