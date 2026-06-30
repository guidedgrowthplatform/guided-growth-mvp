import type { CheckInData } from '@gg/shared/types';
import { apiPost } from './client';

interface CheckinToolResult {
  ok: true;
  result: { recorded: boolean; date: string; checkin: CheckInData };
}

function callCheckinTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return apiPost<T>('/api/llm/checkin-tool', { toolName, args, timezone });
}

// Same handlers the coach fires by voice.
export function recordCheckinTool(args: Partial<CheckInData>): Promise<CheckinToolResult> {
  return callCheckinTool<CheckinToolResult>('record_checkin', args);
}

export function completeHabitTool(habitId: string): Promise<{ ok: true }> {
  return callCheckinTool<{ ok: true }>('complete_habit', { habit_id: habitId });
}

export function logReflectionTool(text: string): Promise<{ ok: true }> {
  return callCheckinTool<{ ok: true }>('log_reflection', { text });
}

export function resetCheckinTodayQA(): Promise<{ ok: true; date: string }> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return apiPost('/api/qa/reset-checkin', { timezone });
}
