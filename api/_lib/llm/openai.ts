export class OpenAIError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.name = 'OpenAIError';
  }
}

// "try again in 7.897s" / "in 850ms" → ms, clamped [500, 8000]. Falls back to 2000.
export function parseRetryAfterMs(message: string | undefined): number {
  const fallback = 2000;
  if (!message) return fallback;
  const sec = message.match(/try again in\s+([\d.]+)\s*s/i);
  if (sec) return clampBackoff(Math.round(parseFloat(sec[1]) * 1000));
  const ms = message.match(/try again in\s+([\d.]+)\s*ms/i);
  if (ms) return clampBackoff(Math.round(parseFloat(ms[1])));
  return fallback;
}

function clampBackoff(ms: number): number {
  if (!Number.isFinite(ms)) return 2000;
  return Math.min(8000, Math.max(500, ms));
}

export function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError('OPENAI_API_KEY not configured', 500);
  return apiKey;
}
