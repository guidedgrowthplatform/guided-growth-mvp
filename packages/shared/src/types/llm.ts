import type { CoachingStyle } from '../coaching/styles.js';
import type { SessionStateDeltaEntry } from './context.js';
export type { CoachingStyle };

export interface LLMRequest {
  session_id: string;
  screen_id: string;
  user_message: string;
  coaching_style?: CoachingStyle;
  // Client-supplied optimistic state_delta from the local sessionLogStore.
  // When present, the backend uses these instead of querying session_log,
  // closing the race where a fire-and-forget logEvent hasn't landed yet.
  recent_events?: SessionStateDeltaEntry[];
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
