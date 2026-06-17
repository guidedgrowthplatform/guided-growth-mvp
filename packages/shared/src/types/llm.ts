import type { CoachingStyle } from '../coaching/styles.js';
import type { SessionStateDeltaEntry } from './context.js';
export type { CoachingStyle };

export interface LLMRequest {
  session_id: string;
  screen_id: string;
  user_message: string;
  coaching_style?: CoachingStyle;
  mode?: 'chat' | 'opener';
  chat_session_id?: string;
  user_turn_id?: string;
  // Client-supplied optimistic state_delta from the local sessionLogStore.
  // When present, the backend uses these instead of querying session_log,
  // closing the race where a fire-and-forget logEvent hasn't landed yet.
  recent_events?: SessionStateDeltaEntry[];
  // Client IANA timezone; server validates, falls back to UTC. Used for check-in
  // date math so "today"/"yesterday" resolve to the user's local day, not server UTC.
  timezone?: string;
  // Input modality of this turn. Server defaults to 'text' when absent — text
  // phrasing ("type") is harmless aloud, but voice phrasing ("tap the orb")
  // misleads a typer (GitLab #217).
  input_mode?: 'voice' | 'text';
}

export interface ChatHistoryResponse {
  chat_session_id: string;
  messages: LLMChatMessage[];
}

export interface ChatSessionResponse {
  chat_session_id: string;
  messages: LLMChatMessage[];
}

export interface LinearHistoryResponse {
  messages: LLMChatMessage[];
  next_cursor: string | null;
  has_more: boolean;
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
