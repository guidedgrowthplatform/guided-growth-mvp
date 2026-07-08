import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLinearHistory } from '@/api/chat';
import { useAuthStore } from '@/stores/authStore';
import type { LLMChatMessage } from '@gg/shared/types/llm';

type ChatHistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

const PAGE_SIZE = 50;

export interface UseChatHistoryReturn {
  initialMessages: LLMChatMessage[];
  loadOlder: () => Promise<LLMChatMessage[]>;
  hasMore: boolean;
  loadingOlder: boolean;
  status: ChatHistoryStatus;
}

// Linear per-user coach timeline — first page (chronological) seeds useLLM;
// loadOlder pages UP via next_cursor. In-memory only + refetch on auth change,
// mirroring useChatSession (shared tab must not leak one user's history).
export function useChatHistory(opts?: { enabled?: boolean }): UseChatHistoryReturn {
  const enabled = opts?.enabled ?? true;
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [initialMessages, setInitialMessages] = useState<LLMChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [status, setStatus] = useState<ChatHistoryStatus>('idle');

  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    setInitialMessages([]);
    setHasMore(false);
    setLoadingOlder(false);
    cursorRef.current = null;
    if (!enabled || !userId) {
      setStatus(enabled ? 'error' : 'idle');
      return;
    }
    setStatus('loading');
    const controller = new AbortController();
    // One-shot retry: downstream stays gated on 'error' (no blank-timeline seed),
    // so recover from a transient blip rather than wedging the overlay.
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetchLinearHistory({ limit: PAGE_SIZE, signal: controller.signal });
          if (controller.signal.aborted) return;
          setInitialMessages(res.messages);
          cursorRef.current = res.next_cursor;
          setHasMore(res.has_more);
          setStatus('ready');
          return;
        } catch {
          if (controller.signal.aborted) return;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          setStatus('error');
        }
      }
    })();
    return () => controller.abort();
  }, [userId, enabled]);

  const loadOlder = useCallback(async (): Promise<LLMChatMessage[]> => {
    if (loadingOlder || !hasMore || !cursorRef.current) return [];
    setLoadingOlder(true);
    try {
      const res = await fetchLinearHistory({ before: cursorRef.current, limit: PAGE_SIZE });
      cursorRef.current = res.next_cursor;
      setHasMore(res.has_more);
      return res.messages;
    } catch {
      return [];
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore]);

  return { initialMessages, loadOlder, hasMore, loadingOlder, status };
}
