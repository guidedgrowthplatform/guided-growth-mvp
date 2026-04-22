import { gateway, generateText } from 'ai';
import crypto from 'crypto';
import { checkRateLimit } from './rate-limit.js';

const INSIGHT_MODEL_ID = 'anthropic/claude-haiku-4.5';

const REFLECTION_INSIGHT_SYSTEM_PROMPT = `You write short, warm observations about someone's journal entry.

Rules:
- 2 to 3 sentences. No more.
- Refer specifically to what they wrote — do not give generic advice.
- If the recent entries show a pattern or streak, name it (e.g. "three productive days in a row", "second walk this week").
- Never open with "It sounds like…" or "Remember that…".
- Never moralize. Never recommend professional help. Never use exclamation marks.
- Write in second person ("you").`;

function buildPrompt(input: {
  bodyText: string;
  mood: string | null;
  recentContext: Array<{ createdAt: string; mood: string | null; preview: string }>;
}): string {
  const { bodyText, mood, recentContext } = input;
  const ctx =
    recentContext.length === 0
      ? '(none yet)'
      : recentContext
          .map((e, i) => {
            const parts = [e.createdAt];
            if (e.mood) parts.push(e.mood);
            return `${i + 1}. [${parts.join(' · ')}] ${e.preview}`;
          })
          .join('\n');

  return [
    `TODAY'S ENTRY:`,
    bodyText.slice(0, 2000),
    mood ? `Mood: ${mood}` : '',
    '',
    `RECENT ENTRIES (most recent first):`,
    ctx,
  ]
    .filter(Boolean)
    .join('\n');
}

export function computeContentHash(input: {
  fields: Record<string, string>;
  mood: string | null;
}): string {
  const sorted = Object.keys(input.fields ?? {})
    .sort()
    .map((k) => `${k}=${input.fields[k] ?? ''}`)
    .join('\n');
  const payload = `${sorted}\n__mood=${input.mood ?? ''}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface GenerationInput {
  userId: string;
  bodyText: string;
  mood: string | null;
  recentContext: Array<{ createdAt: string; mood: string | null; preview: string }>;
}

export async function generateReflectionInsight(input: GenerationInput): Promise<string | null> {
  if (process.env.AI_INSIGHTS_ENABLED !== 'true') return null;
  if (!input.bodyText || !input.bodyText.trim()) return null;

  const rate = checkRateLimit(input.userId, {
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'ai-insight',
  });
  if (rate.limited) {
    console.warn('ai_insight_rate_limited', { userId: input.userId });
    return null;
  }

  try {
    const result = await generateText({
      model: gateway(INSIGHT_MODEL_ID),
      system: REFLECTION_INSIGHT_SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      abortSignal: AbortSignal.timeout(4000),
    });
    const text = result.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error('ai_insight_failed', {
      userId: input.userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
