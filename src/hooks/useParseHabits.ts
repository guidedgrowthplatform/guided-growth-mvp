import { useCallback, useState } from 'react';
import { parseBrainDump } from '@/api/parseHabits';
import { useSessionLog } from '@/hooks/useSessionLog';
import { parseHabitsFromText } from '@/lib/utils/parse-habits-from-text';
import type { ParsedHabit } from '@gg/shared/types';

const PARSE_TIMEOUT_MS = 12_000;

export type ParseSource = 'llm' | 'regex_fallback';

export interface ParseResult {
  habits: ParsedHabit[];
  source: ParseSource;
}

export function useParseHabits() {
  const { sessionId } = useSessionLog();
  const [loading, setLoading] = useState(false);

  const parse = useCallback(
    async (text: string): Promise<ParseResult> => {
      setLoading(true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);
      try {
        const habits = await parseBrainDump(text, sessionId, controller.signal);
        // Empty is a valid AI judgment (no concrete habits) — do NOT regex-fallback.
        return { habits, source: 'llm' };
      } catch {
        return { habits: parseHabitsFromText(text), source: 'regex_fallback' };
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    },
    [sessionId],
  );

  return { parse, loading };
}
