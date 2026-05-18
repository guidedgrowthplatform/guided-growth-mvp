import type { CoachingStyle } from '../coaching/styles.js';
export type { CoachingStyle };

export interface LLMRequest {
  session_id: string;
  screen_id: string;
  user_message: string;
  coaching_style?: CoachingStyle;
}

export type LLMStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; ok: boolean; result: unknown }
  | { type: 'done'; latency_ms: number; total_tokens: number; tool_rounds: number }
  | { type: 'error'; code: string; message: string };

export interface LLMToolEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: { ok: boolean; payload: unknown };
}

export interface LLMChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: LLMToolEvent[];
}
