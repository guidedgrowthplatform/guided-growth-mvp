import type { ChatHistoryResponse, ChatSessionResponse } from '@shared/types/llm';
import { apiGet, apiPost } from './client';

export function fetchChatHistory(
  chatSessionId: string,
  limit?: number,
): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams({ chat_session_id: chatSessionId });
  if (typeof limit === 'number') params.set('limit', String(limit));
  return apiGet<ChatHistoryResponse>(`/api/chat/history?${params.toString()}`);
}

export function createOrResumeChatSession(
  screenId: string,
  opts?: { resume?: boolean },
): Promise<ChatSessionResponse> {
  return apiPost<ChatSessionResponse>('/api/chat/session', {
    screen_id: screenId,
    ...(opts?.resume === false ? { resume: false } : {}),
  });
}
