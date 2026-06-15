import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useChatSession } from '@/hooks/useChatSession';
import {
  getOrCreateOnboardingChatSessionId,
  setOnboardingChatSessionId,
} from '@/lib/onboarding/onboardingChatSession';
import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/authStore';
import type { OnboardingState } from '@gg/shared/types';
import type { LLMChatMessage } from '@gg/shared/types/llm';

const EMPTY_INITIAL_MESSAGES: LLMChatMessage[] = [];

export interface OnboardingChatSession {
  chatSessionId: string | null;
  initialMessages: LLMChatMessage[];
  useStableSession: boolean;
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

  // Read-only subscription to the cache populated by useAppGate (no own fetch).
  const { data: onboardingState } = useQuery<OnboardingState | null>({
    queryKey: queryKeys.onboarding.state,
    queryFn: () => null,
    enabled: false,
  });
  const serverChatSessionId = onboardingState?.chat_session_id ?? null;

  useEffect(() => {
    if (serverChatSessionId) setOnboardingChatSessionId(serverChatSessionId);
  }, [serverChatSessionId]);

  // Server row wins on resume; else bootstrap a local id until the server binds one.
  const stableChatSessionId = useMemo(
    () => (useStableSession ? (serverChatSessionId ?? getOrCreateOnboardingChatSessionId()) : null),
    [useStableSession, serverChatSessionId],
  );

  const legacy = useChatSession(screenId, {
    enabled: enabled && !!screenId && !useStableSession,
    resume: !isOnboardingScreen,
  });

  return useStableSession
    ? {
        chatSessionId: stableChatSessionId,
        initialMessages: EMPTY_INITIAL_MESSAGES,
        useStableSession,
      }
    : {
        chatSessionId: legacy.chatSessionId,
        initialMessages: legacy.initialMessages,
        useStableSession,
      };
}
