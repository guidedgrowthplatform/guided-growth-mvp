import { useEffect, useState } from 'react';
import { createOrResumeChatSession } from '@/api/chat';
import { useAuthStore } from '@/stores/authStore';
import type { LLMChatMessage } from '@shared/types/llm';

export type ChatSessionStatus = 'loading' | 'ready' | 'error';

export interface UseChatSessionReturn {
  chatSessionId: string | null;
  initialMessages: LLMChatMessage[];
  status: ChatSessionStatus;
}

// In-memory only (no localStorage) + refetch on auth change — a shared tab
// must not carry one user's session into another's login.
export function useChatSession(screenId: string): UseChatSessionReturn {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<LLMChatMessage[]>([]);
  const [status, setStatus] = useState<ChatSessionStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    setChatSessionId(null);
    setInitialMessages([]);
    if (!userId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    void (async () => {
      try {
        const res = await createOrResumeChatSession(screenId);
        if (cancelled) return;
        setChatSessionId(res.chat_session_id);
        setInitialMessages(res.messages);
        setStatus('ready');
      } catch {
        if (cancelled) return;
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenId, userId]);

  return { chatSessionId, initialMessages, status };
}
