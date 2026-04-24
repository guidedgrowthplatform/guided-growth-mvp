import { useEffect, useState } from 'react';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import { useRealtimeVoice, type RealtimeVoiceState } from '@/hooks/useRealtimeVoice';
import { useAuthStore } from '@/stores/authStore';

interface UseOnboardingAgentReturn {
  /** Session state — 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'. */
  voiceState: RealtimeVoiceState;
  /** Latest error message, or null while the session is healthy. */
  voiceError: string | null;
}

/**
 * Wire the real-time Cartesia agent + onboarding realtime sync for a
 * specific onboarding screen.
 *
 * Each screen from ONBOARD-01 onward uses this hook so the agent is live
 * while the user is on that screen. We auto-start only when the browser
 * has already granted mic permission (the earlier MicPermissionPage
 * handles that flow); a missing or denied permission leaves the screen
 * silent and fully form-operable, which matches Phase 1 spec §1.1's
 * denied path.
 *
 * Current limitation — each screen mounts a fresh WebSocket session,
 * which means ~1-2 seconds of silence during screen transitions while
 * the next session connects. A persistent provider that survives route
 * changes is the proper fix; for the MVP demo, per-screen sessions are
 * simple, reliable, and let every step carry the right
 * `metadata.screen` to the agent.
 */
export function useOnboardingAgent(screen: string): UseOnboardingAgentReturn {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Side-effect stream from the agent's tool calls. Each screen subscribes
  // so agent-written fields (e.g. `path`, `category`, habit configs) land in
  // the React Query cache and then in local form state via the screen's own
  // onboardingState.data effect.
  useOnboardingRealtimeSync();

  const {
    start,
    stop,
    state: voiceState,
  } = useRealtimeVoice({
    metadata: { user_id: userId ?? '', screen, coaching_style: 'warm' },
    onError: (message) => setVoiceError(message),
    onEnd: () => setVoiceError(null),
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await navigator.permissions?.query?.({
          name: 'microphone' as PermissionName,
        });
        if (cancelled || perm?.state !== 'granted') return;
        await start();
      } catch {
        // Permissions API not supported on this browser — skip auto-start.
        // The screen still works; the user just won't hear the agent.
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // `start` / `stop` are stable w.r.t. the session; re-running on userId
    // alone is the correct trigger. Listing them in deps would cause an
    // immediate reconnect loop because React re-creates the closures on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, screen]);

  return { voiceState, voiceError };
}
