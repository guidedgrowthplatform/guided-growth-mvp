import type { ParseBrainDumpResponse, ParsedHabit } from '@gg/shared/types';
import { apiPost } from './client';

export async function parseBrainDump(
  text: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ParsedHabit[]> {
  const res = await apiPost<ParseBrainDumpResponse>(
    '/api/llm/parse-brain-dump',
    { text, session_id: sessionId },
    signal,
  );
  return res.habits;
}
