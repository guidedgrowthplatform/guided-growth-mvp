import { useMemo } from 'react';
import { useChatSession } from '@/hooks/useChatSession';
import {
  getOrCreateOnboardingChatSessionId,
  isStableOnboardingChatEnabled,
} from '@/lib/onboarding/onboardingChatSession';
import { useAuthStore } from '@/stores/authStore';
import type { LLMChatMessage } from '@gg/shared/types/llm';

const EMPTY_INITIAL_MESSAGES: LLMChatMessage[] = [];

export interface OnboardingChatSession {
  chatSessionId: string | null;
  initialMessages: LLMChatMessage[];
  useStableSession: boolean;
}

// Stable id (flag-gated + authed) → cross-step LLM memory; else legacy per-screen.
// Auth-gated keeps pre-login behavior unchanged; useChatSession stays unconditional.
export function useOnboardingChatSession(
  screenId: string,
  enabled: boolean,
  isOnboardingScreen: boolean,
): OnboardingChatSession {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const useStableSession = isStableOnboardingChatEnabled() && isOnboardingScreen && !!userId;
  const stableChatSessionId = useMemo(
    () => (useStableSession ? getOrCreateOnboardingChatSessionId() : null),
    [useStableSession],
  );

  const legacy = useChatSession(screenId, {
    enabled: enabled && !!screenId && !useStableSession,
    resume: !isOnboardingScreen,
  });

  return useStableSession
    ? { chatSessionId: stableChatSessionId, initialMessages: EMPTY_INITIAL_MESSAGES, useStableSession }
    : {
        chatSessionId: legacy.chatSessionId,
        initialMessages: legacy.initialMessages,
        useStableSession,
      };
}
