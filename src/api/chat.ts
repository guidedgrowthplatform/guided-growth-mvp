import type { ChatSessionResponse, LinearHistoryResponse } from '@gg/shared/types/llm';
import { apiGet, apiPost } from './client';

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
