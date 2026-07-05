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
  // Client-spoken scripted opener; replayed as a synthetic assistant turn when
  // no previous_response_id exists yet.
  prior_opener?: string;
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

// Onboarding thread turn — flat shape for cross-device rehydration of the voice
// feed. client_turn_key is the stable client id (vapi-/opener-) for voice turns,
// null for Direct-LLM turns; the client uses it to align ids with localStorage.
export interface OnboardingThreadTurn {
  id: string;
  client_turn_key: string | null;
  role: 'user' | 'assistant';
  content: string | null;
  screen_id: string;
}

export interface OnboardingThreadResponse {
  chat_session_id: string | null;
  messages: OnboardingThreadTurn[];
}

export type LLMStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; ok: boolean; result: unknown }
  // Emitted alongside tool_result for a mutating (write) tool that threw — lets
  // the client surface a write failure the user must know about.
  | { type: 'tool_failed'; id: string; name: string; error: string; message?: string }
  // ttft_ms: server-side request-start -> first streamed delta (latency lane T1).
  // Optional so older servers/clients interop during rollout.
  | {
      type: 'done';
      latency_ms: number;
      total_tokens: number;
      tool_rounds: number;
      ttft_ms?: number;
    }
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
  // The screen/beat this turn was captured on. Populated by history rehydration
  // (chat_messages.screen_id) so the chat-native onboarding feed can place each
  // restored turn under its beat. Absent for live turns (tagged client-side).
  screenId?: string;
}
