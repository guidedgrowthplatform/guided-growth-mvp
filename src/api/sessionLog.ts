import type { SessionLogEvent } from '@gg/shared/types/session-events';
import { apiPost } from './client';

export interface LogEventBody {
  session_id: string;
  event_type: SessionLogEvent;
  screen_id?: string;
  payload?: Record<string, unknown>;
}

export function logSessionEvent(body: LogEventBody): Promise<{ id: string; timestamp: string }> {
  return apiPost<{ id: string; timestamp: string }>('/api/session_log', body);
}
