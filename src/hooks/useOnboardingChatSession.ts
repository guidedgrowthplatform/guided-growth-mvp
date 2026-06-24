import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchChatHistory } from '@/api/chat';
import { useChatSession } from '@/hooks/useChatSession';
import { getOrCreateOnboardingChatSessionId } from '@/lib/onboarding/onboardingChatSession';
import { useAuthStore } from '@/stores/authStore';
import type { LLMChatMessage } from '@gg/shared/types/llm';

const EMPTY_INITIAL_MESSAGES: LLMChatMessage[] = [];

export interface OnboardingChatSession {
  chatSessionId: string | null;
  initialMessages: LLMChatMessage[];
  useStableSession: boolean;
  // Persisted thread for the stable (authed) onboarding session, screen_id-tagged
  // so the chat-native feed can place each restored turn under its beat. Display
  // only — LLM memory is server-side via response-chaining. Empty for legacy.
  historyMessages: LLMChatMessage[];
  // True once the history fetch has settled (loaded or failed) — the opener
  // seeding waits on this so a fresh stream doesn't duplicate a restored opener.
  historyLoaded: boolean;
}

// Stable id (authed onboarding) → cross-step LLM memory; else legacy per-screen.
// Pre-login / non-onboarding keeps the legacy per-screen session.
export function useOnboardingChatSession(
  screenId: string,
  enabled: boolean,
  isOnboardingScreen: boolean,
): OnboardingChatSession {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const useStableSession = isOnboardingScreen && !!userId;
  const stableChatSessionId = useMemo(
    () => (useStableSession ? getOrCreateOnboardingChatSessionId() : null),
    [useStableSession],
  );

  const legacy = useChatSession(screenId, {
    enabled: enabled && !!screenId && !useStableSession,
    resume: !isOnboardingScreen,
  });

  // Rehydrate the stable session's persisted thread once per id. Stale-time
  // Infinity: live turns are appended client-side as they happen, so a refetch
  // would only risk racing the live thread.
  const historyEnabled = enabled && useStableSession && !!stableChatSessionId;
  const { data: history, isFetched } = useQuery({
    queryKey: ['onboardingChatHistory', stableChatSessionId],
    queryFn: () => fetchChatHistory(stableChatSessionId as string, { limit: 200 }),
    enabled: historyEnabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (!useStableSession) {
    return {
      chatSessionId: legacy.chatSessionId,
      initialMessages: legacy.initialMessages,
      useStableSession,
      historyMessages: EMPTY_INITIAL_MESSAGES,
      historyLoaded: true,
    };
  }

  return {
    chatSessionId: stableChatSessionId,
    initialMessages: EMPTY_INITIAL_MESSAGES,
    useStableSession,
    historyMessages: history?.messages ?? EMPTY_INITIAL_MESSAGES,
    // No fetch needed when disabled (e.g. id not ready) — treat as loaded so the
    // opener isn't blocked forever.
    historyLoaded: historyEnabled ? isFetched : true,
  };
}
