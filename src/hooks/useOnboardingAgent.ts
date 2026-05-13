import { Capacitor } from '@capacitor/core';
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

// Wire Vapi + onboarding realtime sync per screen. Auto-starts when mic
// permission is 'granted'; on Capacitor native we trust the OS grant
// because the browser Permissions API returns 'prompt' even post-grant.
// Per-screen sessions mean ~1–2s of silence on transitions.
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
    // TODO: Style switching is OFF per Yair (April 9 call). Wire to useUserPreferences when re-enabled.
    metadata: { user_id: userId ?? '', screen, coaching_style: 'warm' },
    onError: (message) => setVoiceError(message),
    onEnd: () => setVoiceError(null),
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        // On Capacitor native, the browser Permissions API returns
        // 'prompt' even when RECORD_AUDIO has been granted at the OS
        // level (verified on Pixel 9 + Capacitor 8 / Android Chromium).
        // Gating on it would mean the agent never auto-starts on
        // Android, even after MicPermissionPage successfully requested
        // the permission. On native we trust the OS grant — `start()`
        // calls getUserMedia() which throws cleanly if the perm is
        // actually missing, and our onError handler surfaces that.
        if (!Capacitor.isNativePlatform()) {
          const perm = await navigator.permissions?.query?.({
            name: 'microphone' as PermissionName,
          });
          if (cancelled || perm?.state !== 'granted') return;
        }
        if (cancelled) return;
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
