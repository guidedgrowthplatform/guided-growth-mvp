import type { ChatSessionResponse } from '@shared/types/llm';
import { apiPost } from './client';

export function createOrResumeChatSession(
  screenId: string,
  opts?: { resume?: boolean },
): Promise<ChatSessionResponse> {
  return apiPost<ChatSessionResponse>('/api/chat/session', {
    screen_id: screenId,
    ...(opts?.resume === false ? { resume: false } : {}),
  });
}
