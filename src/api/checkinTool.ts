import type { CheckInData } from '@gg/shared/types';
import { apiPost } from './client';

interface CheckinToolResult {
  ok: true;
  result: { recorded: boolean; date: string; checkin: CheckInData };
}

// Tap-driven record_checkin. Same handler the coach fires by voice.
export function recordCheckinTool(args: Partial<CheckInData>): Promise<CheckinToolResult> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return apiPost<CheckinToolResult>('/api/llm/checkin-tool', {
    toolName: 'record_checkin',
    args,
    timezone,
  });
}
