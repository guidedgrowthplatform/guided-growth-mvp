import { useEffect, useState } from 'react';
import { createOrResumeChatSession } from '@/api/chat';
import { useAuthStore } from '@/stores/authStore';
import type { LLMChatMessage } from '@gg/shared/types/llm';

export type ChatSessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseChatSessionReturn {
  chatSessionId: string | null;
  initialMessages: LLMChatMessage[];
  status: ChatSessionStatus;
}

// In-memory only (no localStorage) + refetch on auth change — a shared tab
// must not carry one user's session into another's login.
export function useChatSession(
  screenId: string,
  opts?: { enabled?: boolean; resume?: boolean },
): UseChatSessionReturn {
  const enabled = opts?.enabled ?? true;
  const resume = opts?.resume ?? true;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<LLMChatMessage[]>([]);
  const [status, setStatus] = useState<ChatSessionStatus>('loading');

  useEffect(() => {
    setChatSessionId(null);
    setInitialMessages([]);
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (!userId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await createOrResumeChatSession(screenId, {
          resume,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setChatSessionId(res.chat_session_id);
        setInitialMessages(res.messages);
        setStatus('ready');
      } catch {
        if (controller.signal.aborted) return;
        setStatus('error');
      }
    })();
    return () => {
      controller.abort();
    };
  }, [screenId, userId, enabled, resume]);

  return { chatSessionId, initialMessages, status };
}
