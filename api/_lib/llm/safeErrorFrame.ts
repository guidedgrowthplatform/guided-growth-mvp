import { OpenAIError } from './openai.js';

export type SafeErrorCode =
  | 'rate_limited'
  | 'openai_error'
  | 'stream_error'
  | 'internal_error'
  | 'tool_cap_reached';

export interface SafeErrorFrame {
  type: 'error';
  code: SafeErrorCode;
  message: string;
  retryAfterMs?: number;
}

const GENERIC: Record<SafeErrorCode, string> = {
  rate_limited: "I'm a little overloaded right now — give me a second and try again.",
  openai_error: "Something didn't work on my end. Mind trying that again?",
  stream_error: "Something didn't work on my end. Mind trying that again?",
  internal_error: "Something didn't work on my end. Mind trying that again?",
  tool_cap_reached: 'I got a bit tangled up there — try that once more?',
};

export function isRateLimit(err: unknown): boolean {
  if (err instanceof OpenAIError && err.status === 429) return true;
  const status = (err as { status?: number })?.status;
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as { message?: string })?.message ?? '';
  return status === 429 || code === 'rate_limit_exceeded' || /\brate limit\b/i.test(message);
}

// Maps an upstream code/error to a client-safe frame. Raw detail stays in logs only.
export function safeErrorFrame(code: SafeErrorCode, err?: unknown): SafeErrorFrame {
  const frame: SafeErrorFrame = { type: 'error', code, message: GENERIC[code] };
  if (code === 'rate_limited' && err instanceof OpenAIError && err.retryAfterMs) {
    frame.retryAfterMs = err.retryAfterMs;
  }
  return frame;
}
