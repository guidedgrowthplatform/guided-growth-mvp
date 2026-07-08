import { useCallback, useEffect, useRef, useState } from 'react';
import { parseBrainDump } from '@/api/parseHabits';
import { useSessionLog } from '@/hooks/useSessionLog';
import { Sentry } from '@/lib/sentry';
import { parseHabitsFromText } from '@/lib/utils/parse-habits-from-text';
import type { ParsedHabit } from '@gg/shared/types';

// Above server's 18s so a slow LLM lands instead of aborting early to regex.
const PARSE_TIMEOUT_MS = 20_000;

type ParseSource = 'llm' | 'regex_fallback';

export interface ParseResult {
  habits: ParsedHabit[];
  source: ParseSource;
}

export function useParseHabits() {
  const { sessionId } = useSessionLog();
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const parse = useCallback(
    async (text: string): Promise<ParseResult> => {
      setLoading(true);
      // Cancel any in-flight parse so a double-call doesn't orphan its request.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);
      try {
        const habits = await parseBrainDump(text, sessionId, controller.signal);
        // Empty is a valid AI judgment (no concrete habits) — do NOT regex-fallback.
        return { habits, source: 'llm' };
      } catch (e) {
        const isAbort = e instanceof DOMException && e.name === 'AbortError';
        // Skip breadcrumb on unmount-abort (intentional cancel, not a failure).
        if (mountedRef.current) {
          Sentry.addBreadcrumb({
            category: 'parse_brain_dump',
            level: isAbort ? 'warning' : 'error',
            message: isAbort ? 'parse timeout — regex fallback' : 'parse error — regex fallback',
            data: { reason: isAbort ? 'timeout' : 'error' },
          });
        }
        return { habits: parseHabitsFromText(text), source: 'regex_fallback' };
      } finally {
        clearTimeout(timer);
        if (mountedRef.current) setLoading(false);
      }
    },
    [sessionId],
  );

  return { parse, loading };
}
