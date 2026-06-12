import { waitUntil } from '@vercel/functions';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../db.js';
import { normalizeParsedHabits } from './normalizeParsedHabits.js';
import { reportRequestFailure } from '../sentry.js';
import { OpenAIError } from './openai.js';
import { openResponsesJSON, type ToolSchema } from './openai-responses.js';

const PARSE_MODEL = 'gpt-4o-mini';
const PARSE_TIMEOUT_MS = 18_000;

interface ParseUser {
  anonId: string;
}

const PARSE_TOOL: ToolSchema = {
  name: 'submit_parsed_habits',
  description: 'Return the habits extracted from the user brain dump.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      habits: {
        type: 'array',
        maxItems: 50,
        description: 'One entry per distinct habit the user actually mentioned.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', description: 'Short habit name, max 100 chars.' },
            frequency: {
              type: 'string',
              enum: ['daily', 'weekdays', 'weekends', 'weekly', '3x/week'],
              description: 'How often the habit recurs.',
            },
            days: {
              type: 'array',
              description: 'Weekday indices 0=Sun..6=Sat, only when the user stated specific days.',
              items: { type: 'integer' },
            },
            time: { type: 'string', description: 'HH:MM 24h, only when explicitly stated.' },
          },
          required: ['name', 'frequency'],
        },
      },
    },
    required: ['habits'],
  },
};

const INSTRUCTIONS = `Convert the user's free-text or voice "brain dump" into a list of concrete, trackable habits.
Rules:
- One habit per distinct intention the user expressed.
- NEVER invent habits the user did not mention. If nothing concrete is present, return an empty list.
- Infer frequency, days, and time ONLY when the user stated them ("three times a week", "every weekday", "on Mondays", "at 8 PM"). Otherwise omit days/time.
- Keep habit names short and positive where natural.
Return the result by calling submit_parsed_habits.`;

export async function handleParseBrainDump(
  req: VercelRequest,
  res: VercelResponse,
  user: ParseUser,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 5000) {
    res.status(400).json({ error: 'text is required (1-5000 chars)' });
    return;
  }
  const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
  if (sessionId.trim().length < 8) {
    res.status(400).json({ error: 'session_id must be a string of at least 8 chars' });
    return;
  }
  const screenId =
    typeof body.screen_id === 'string' && body.screen_id.length > 0 && body.screen_id.length <= 200
      ? body.screen_id
      : 'ONBOARD-ADVANCED';

  const startedAt = performance.now();
  const abortController = new AbortController();
  // Bound the upstream call; Vercel maxDuration is the hard ceiling otherwise.
  const timeout = setTimeout(() => abortController.abort(), PARSE_TIMEOUT_MS);
  req.on('close', () => abortController.abort());
  try {
    const { data, totalTokens } = await openResponsesJSON<unknown>({
      model: PARSE_MODEL,
      instructions: INSTRUCTIONS,
      input: [{ type: 'message', role: 'user', content: text }],
      tool: PARSE_TOOL,
      signal: abortController.signal,
    });
    const habits = normalizeParsedHabits(data);
    const latencyMs = Math.round(performance.now() - startedAt);

    waitUntil(
      logParse(user.anonId, sessionId, screenId, 'ok', latencyMs, totalTokens, habits.length),
    );
    res.status(200).json({ habits });
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    waitUntil(logParse(user.anonId, sessionId, screenId, 'error', latencyMs, 0, 0));
    if (res.writableEnded || res.headersSent) return;
    const aborted = err instanceof Error && err.name === 'AbortError';
    const status = aborted ? 504 : err instanceof OpenAIError ? err.status : 500;
    res.status(status).json({ error: aborted ? 'parse_timeout' : 'parse_failed' });
  } finally {
    clearTimeout(timeout);
  }
}

async function logParse(
  anonId: string,
  sessionId: string,
  screenId: string,
  status: 'ok' | 'error',
  latencyMs: number,
  totalTokens: number,
  habitsCount: number,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        anonId,
        sessionId,
        'llm_call',
        screenId,
        {
          kind: 'parse_brain_dump',
          status,
          latency_ms: latencyMs,
          total_tokens: totalTokens,
          habits_count: habitsCount,
        },
      ],
    );
  } catch {
    // best-effort logging; never block the response
    reportRequestFailure('parse-brain-dump', 'log_write_failed', anonId);
  }
}
