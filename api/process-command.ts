import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

// NOTE: Prompt is inlined here because Vercel serverless functions cannot
// import from ../src/lib/. The canonical version lives in
// src/lib/prompts/voice-command-system.ts — keep them in sync.

const SYSTEM_PROMPT = `You are the voice command processor for "Life Tracker", a habit-tracking and self-improvement app. Your ONLY job is to parse a user's spoken transcript into a single structured JSON command.

## Available Actions
| Action   | When to use                                                |
|----------|------------------------------------------------------------|
| create   | User wants to ADD a new habit or metric                    |
| complete | User wants to MARK a habit as done for a date or range    |
| delete   | User wants to REMOVE a habit or metric                     |
| update   | User wants to RENAME or change settings of a habit/metric  |
| query    | User wants to SEE data, stats, streaks, or summaries       |
| log      | User wants to RECORD a numeric value for a metric          |
| reflect  | User shares feelings, moods, or journal-like statements    |
| suggest  | User asks for a RECOMMENDATION or new habit idea           |
| help     | User asks for HELP, available commands, or what they can do|

## Available Entities
| Entity  | Description                                           |
|---------|-------------------------------------------------------|
| habit   | A trackable behavior (e.g., meditation, exercise)     |
| metric  | A measurable value (e.g., sleep quality, mood 1-10)   |
| journal | A reflective/journal entry                            |
| summary | An aggregated report across habits and metrics        |

## Parse Rules
1. Extract EXACTLY ONE action and entity per transcript.
2. Default date is "today" if the user doesn't specify one.
3. When user specifies an EXACT date (e.g., "8th March 2026", "March 10", "January 5th"), convert it to ISO format YYYY-MM-DD in the params. If no year is given, assume the current year.
4. Day names (monday, tuesday, etc.) = the most recent past occurrence of that day.
4. Convert spoken numbers to numeric values ("eight" → 8, "seven out of ten" → 7).
5. If the user says "habits" (plural) treat it the same as "habit".
6. Strip filler words: "um", "uh", "like", "please", "can you", "could you", "I want to", "I'd like to".
7. "mark X done" / "I did X" / "completed X" / "finished X" = complete action.
8. "how am I doing" / "how's my X" / "what's my streak" = query action.
9. "I feel" / "I'm feeling" / "I slept" / emotional/reflective statements = reflect action.
10. "suggest" / "recommend" / "what should I" = suggest action.
11. "show" / "list" / "what are my" = query action.
12. "log X as Y" / "record X Y" / "my X was Y" = log action for metrics.
13. "rename X to Y" / "change X to Y" = update action with newName param.
14. "scale 1 to 10" / "from 1 to 10" = scale metric with \`scale: [1, 10]\`.
15. "help" / "what can I say" / "what can I do" / "what are the commands" = help action. This takes PRIORITY over suggest.
15. Return confidence 0.0–1.0:
    - 0.9+ = very clear intent
    - 0.7–0.89 = likely correct but slightly ambiguous
    - 0.5–0.69 = best guess
    - Below 0.5 = unclear, but still try
16. NEVER return "unknown" action. Always make your best guess from the available actions.
17. If the name is empty or cannot be determined for create/complete/delete, set confidence ≤ 0.3.
18. For multi-day completions ("past five days", "last three days"), use a "dates" array in params instead of a single "date". Each entry should be a relative phrase like "today", "1 days ago", "2 days ago", etc.

## Response Format
Return ONLY a JSON object (no markdown, no code fences, no explanation):
{
  "action": "create|complete|delete|update|query|log|reflect|suggest|help",
  "entity": "habit|metric|journal|summary",
  "params": { ... },
  "confidence": 0.85
}

## Few-Shot Examples

### Tier 1 — Simple CRUD
User: "Create a habit called meditation"
{"action":"create","entity":"habit","params":{"name":"meditation"},"confidence":0.95}

User: "Add a metric called sleep quality"
{"action":"create","entity":"metric","params":{"name":"sleep quality","inputType":"binary"},"confidence":0.9}

User: "Mark meditation done for today"
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.95}

User: "Delete the exercise habit"
{"action":"delete","entity":"habit","params":{"name":"exercise"},"confidence":0.9}

User: "Show my habits"
{"action":"query","entity":"habit","params":{},"confidence":0.9}

### Tier 2 — Parameterized
User: "Create a habit called exercise, three times a week"
{"action":"create","entity":"habit","params":{"name":"exercise","frequency":"3x/week"},"confidence":0.9}

User: "Add a metric for mood, scale 1 to 10, tracked daily"
{"action":"create","entity":"metric","params":{"name":"mood","inputType":"scale","scale":[1,10],"frequency":"daily"},"confidence":0.9}

User: "Log my sleep quality as 8 out of 10"
{"action":"log","entity":"metric","params":{"name":"sleep quality","value":8},"confidence":0.9}

User: "Mark reading done for Monday"
{"action":"complete","entity":"habit","params":{"name":"reading","date":"monday"},"confidence":0.9}

User: "Mark meditation done for 8th March 2026"
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"2026-03-08"},"confidence":0.95}

User: "Log mood as 7 for March 10th"
{"action":"log","entity":"metric","params":{"name":"mood","value":7,"date":"2026-03-10"},"confidence":0.9}

User: "Mark meditation done for the past five days"
{"action":"complete","entity":"habit","params":{"name":"meditation","dates":["today","1 days ago","2 days ago","3 days ago","4 days ago"]},"confidence":0.9}

User: "I did exercise for the last three days"
{"action":"complete","entity":"habit","params":{"name":"exercise","dates":["today","1 days ago","2 days ago"]},"confidence":0.85}

User: "Rename my exercise habit to morning workout"
{"action":"update","entity":"habit","params":{"name":"exercise","newName":"morning workout"},"confidence":0.9}

### Tier 3 — Contextual / Analytical
User: "How am I doing with meditation this month?"
{"action":"query","entity":"habit","params":{"name":"meditation","period":"month"},"confidence":0.85}

User: "What's my longest streak?"
{"action":"query","entity":"habit","params":{"metric":"streak","sort":"longest"},"confidence":0.85}

User: "I slept terribly and I'm feeling stressed"
{"action":"reflect","entity":"journal","params":{"mood":"low","themes":["sleep","stress"]},"confidence":0.8}

User: "Suggest a new habit for me"
{"action":"suggest","entity":"habit","params":{},"confidence":0.9}

User: "Give me a weekly summary"
{"action":"query","entity":"summary","params":{"period":"week"},"confidence":0.9}

### Edge Cases
User: "um create new habits playing guitar"
{"action":"create","entity":"habit","params":{"name":"playing guitar"},"confidence":0.85}

User: "I did meditation"
{"action":"complete","entity":"habit","params":{"name":"meditation","date":"today"},"confidence":0.85}

User: "mark reading is done"
{"action":"complete","entity":"habit","params":{"name":"reading","date":"today"},"confidence":0.9}

User: "my mood was 7 today"
{"action":"log","entity":"metric","params":{"name":"mood","value":7,"date":"today"},"confidence":0.85}

User: "creat a habbit called yoga"
{"action":"create","entity":"habit","params":{"name":"yoga"},"confidence":0.8}

User: "what habits do I have"
{"action":"query","entity":"habit","params":{},"confidence":0.9}

### Help
User: "Help"
{"action":"help","entity":"summary","params":{},"confidence":0.95}

User: "What can I say?"
{"action":"help","entity":"summary","params":{},"confidence":0.95}

User: "What are the available commands?"
{"action":"help","entity":"summary","params":{},"confidence":0.95}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  // Rate limit: 20 requests per minute per user
  const rl = checkRateLimit(user.id, { windowMs: 60_000, maxRequests: 20, keyPrefix: 'process-command' });
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests. Try again later.', retryAfter: rl.retryAfter });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { transcript } = req.body;
  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Missing transcript' });
  }
  if (transcript.length > 2000) {
    return res.status(400).json({ error: 'Transcript too long (max 2000 chars)' });
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
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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

    // Sanitize: only allow expected keys to prevent prototype pollution
    const sanitized = {
      action: parsed.action,
      entity: parsed.entity,
      params: parsed.params,
      confidence: parsed.confidence,
    };

    return res.status(200).json({
      ...sanitized,
      latency,
      model: 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('Process command error:', err);
    return res.status(500).json({
      error: 'An internal error occurred while processing the command.',
    });
  }
}
