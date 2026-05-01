import { useEffect, useState, useRef, useCallback } from 'react';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import { useRealtimeVoice, type RealtimeVoiceState } from '@/hooks/useRealtimeVoice';
import { useScreenContext } from '@/hooks/useScreenContext';
import { useAuthStore } from '@/stores/authStore';

export interface UseOnboardingAgentReturn {
  /** Session state — 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'. */
  voiceState: RealtimeVoiceState;
  /** Latest error message, or null while the session is healthy. */
  voiceError: string | null;
  /** Manually trigger the voice agent session */
  startVoice: () => Promise<void>;
  /** Manually stop the voice agent session */
  stopVoice: () => void;
}

/**
 * Wire the real-time Cartesia agent + onboarding realtime sync for a
 * specific onboarding screen.
 *
 * In the v6.0 dual-path architecture, the agent does NOT auto-start.
 * It strictly waits for explicit user invocation (e.g., tapping the mic)
 * to minimize concurrency pressure and cost.
 */
export function useOnboardingAgent(screen: string): UseOnboardingAgentReturn {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Side-effect stream from the agent's tool calls. Each screen subscribes
  // so agent-written fields (e.g. `path`, `category`, habit configs) land in
  // the React Query cache and then in local form state via the screen's own
  // onboardingState.data effect.
  useOnboardingRealtimeSync();

  // MINTESNOT: This is ready for your real hook implementation
  const { aiContextBlock, stateDelta } = useScreenContext(screen);

  const {
    start,
    stop,
    state: voiceState,
  } = useRealtimeVoice({
    metadata: {
      user_id: userId ?? '',
      screen,
      coaching_style: 'warm',
      ai_context_block: aiContextBlock,
      state_delta: stateDelta,
    },
    onError: (message) => setVoiceError(message),
    onEnd: () => setVoiceError(null),
  });

  const isStartingRef = useRef(false);

  // Lightweight guard to ensure Cartesia never starts unintentionally or twice concurrently
  const safeStartVoice = useCallback(async () => {
    if (isStartingRef.current || voiceState !== 'idle') {
      console.warn(
        '[Cartesia] Agent already active or starting. Ignoring redundant start trigger.',
      );
      return;
    }
    isStartingRef.current = true;
    try {
      await start();
    } finally {
      isStartingRef.current = false;
    }
  }, [start, voiceState]);

  // Ensure any active session is torn down if the component unmounts
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { voiceState, voiceError, startVoice: safeStartVoice, stopVoice: stop };
}
