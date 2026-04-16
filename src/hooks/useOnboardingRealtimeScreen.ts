import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import type { UserContext } from '@/lib/coaching/systemPrompt';
import { supabase } from '@/lib/supabase';
import { nextRouteFor } from '@/lib/voice/screenFlow';
import type { VoiceScreenId } from '@/lib/voice/screenFlow';

interface UseOnboardingRealtimeScreenOptions {
  /** Which ONBOARD screen this page represents. Drives the agent's intro
   * line via the Line backend (`scripts/cartesia-line-agent/main.py`) and
   * the navigation destination picked from `screenFlow`. */
  screen: VoiceScreenId;
  /** Coaching context forwarded to the system prompt. */
  userContext?: UserContext;
  /** Called whenever the agent calls `update_onboarding_data` so the page
   * can reflect the captured value in its own local form state. */
  onFieldCaptured?: (field: string, value: string) => void;
  /** Override: if provided, this runs instead of the default
   * `navigate(nextRouteFor(screen))`. Use for branch decisions like the
   * advanced fork on ONBOARD-02. */
  onNavigate?: (dest: string | null, args: Record<string, unknown>) => void;
  /** Whether to auto-start the voice session on mount. Defaults to true. */
  autoStart?: boolean;
}

/**
 * Thin wrapper around useRealtimeVoice that standardizes how every Phase 1
 * onboarding page wires up the Cartesia Line agent:
 *
 *   - Fetches the current user id and passes it + `screen` as metadata so
 *     the agent picks the right per-screen intro line.
 *   - Auto-starts the session once the user id lands.
 *   - Subscribes to `navigate_next` tool calls and routes via `screenFlow`.
 *   - Surfaces `update_onboarding_data` tool calls via `onFieldCaptured`.
 *
 * Pages remain free to hide/show their legacy "Continue" button as a
 * fallback — `isActive` / `aiTranscript` / `userTranscript` are returned so
 * the UI can reflect voice state.
 */
export function useOnboardingRealtimeScreen(options: UseOnboardingRealtimeScreenOptions) {
  const { screen, userContext, onFieldCaptured, onNavigate, autoStart = true } = options;
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const startedRef = useRef(false);

  const realtime = useRealtimeVoice({
    userContext: userContext ?? { coachingStyle: 'warm' },
    metadata: { user_id: userId, screen },
    onToolCall: (name, args) => {
      if (name === 'update_onboarding_data') {
        const field = String(args.field ?? '');
        const value = String(args.value ?? '');
        if (field) onFieldCaptured?.(field, value);
        return;
      }
      if (name === 'navigate_next') {
        const fromScreen = (args.from_screen as string | undefined) ?? screen;
        const path = args.path as string | undefined;
        const dest = nextRouteFor(fromScreen, path);
        if (onNavigate) {
          onNavigate(dest, args);
          return;
        }
        if (!dest) return;
        // Tear down voice before navigation so the next page owns the
        // microphone without fighting over audio context.
        window.setTimeout(() => {
          realtime.stop();
          startedRef.current = false;
          navigate(dest, { replace: true });
        }, 400);
      }
    },
  });

  // Pull the authed user id once; needed by tools to persist data.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data?.user?.id) setUserId(data.user.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-start the session as soon as the user id is known (needed by the
  // agent's tool calls) and exactly once per mount.
  useEffect(() => {
    if (!autoStart) return;
    if (!userId) return;
    if (startedRef.current) return;
    startedRef.current = true;
    realtime.start({ user_id: userId, screen }).catch(() => {
      startedRef.current = false;
    });
    return () => {
      realtime.stop();
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, autoStart, screen]);

  const manualStart = useCallback(() => {
    if (!userId || startedRef.current) return;
    startedRef.current = true;
    realtime.start({ user_id: userId, screen }).catch(() => {
      startedRef.current = false;
    });
  }, [realtime, userId, screen]);

  return {
    state: realtime.state,
    isActive: realtime.isActive,
    aiTranscript: realtime.aiTranscript,
    userTranscript: realtime.userTranscript,
    streamId: realtime.streamId,
    start: manualStart,
    stop: realtime.stop,
  };
}
