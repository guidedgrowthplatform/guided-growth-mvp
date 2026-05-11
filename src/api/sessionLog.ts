import { apiPost } from './client';

interface LogEventPayload {
  session_id: string;
  event_type: string;
  screen_id?: string;
  payload?: Record<string, unknown>;
}

export function logSessionEvent(
  data: LogEventPayload,
): Promise<{ id: string; timestamp: string }> {
  return apiPost<{ id: string; timestamp: string }>('/api/session_log', data);
}
