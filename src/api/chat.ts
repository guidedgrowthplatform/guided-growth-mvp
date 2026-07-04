import type {
  ChatHistoryResponse,
  ChatSessionResponse,
  LinearHistoryResponse,
  OnboardingThreadResponse,
} from '@gg/shared/types/llm';
import { apiGet, apiPost } from './client';

export interface AppendChatTurnPayload {
  chat_session_id: string;
  screen_id: string;
  role: 'user' | 'ai' | 'assistant';
  text: string;
  client_turn_key: string;
  mode?: 'chat' | 'opener';
}

// Persist one voice/Vapi turn. Idempotent per client_turn_key (the stable
// VoiceMessage id) — a turn whose merged text grows re-POSTs the same key.
export function appendChatTurn(payload: AppendChatTurnPayload): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/api/chat/append', payload);
}

// Resolve the canonical onboarding thread for this anon_id (cross-device).
export function fetchOnboardingThread(): Promise<OnboardingThreadResponse> {
  return apiGet<OnboardingThreadResponse>('/api/chat/onboarding-thread');
}

// Full message history for a known chat_session_id (cross-screen). Used to
// rehydrate the chat-native onboarding thread, whose stable session spans beats.
export function fetchChatHistory(
  chatSessionId: string,
  opts?: { limit?: number },
): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams({ chat_session_id: chatSessionId });
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  return apiGet<ChatHistoryResponse>(`/api/chat/history?${params.toString()}`);
}

export function createOrResumeChatSession(
  screenId: string,
  opts?: { resume?: boolean; signal?: AbortSignal },
): Promise<ChatSessionResponse> {
  return apiPost<ChatSessionResponse>(
    '/api/chat/session',
    {
      screen_id: screenId,
      ...(opts?.resume === false ? { resume: false } : {}),
    },
    opts?.signal,
  );
}

export function fetchLinearHistory(opts?: {
  before?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<LinearHistoryResponse> {
  const params = new URLSearchParams();
  if (opts?.before) params.set('before', opts.before);
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiGet<LinearHistoryResponse>(`/api/chat/linear${qs ? `?${qs}` : ''}`);
}
