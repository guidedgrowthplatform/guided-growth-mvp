import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type Vapi from '@vapi-ai/web';
import { track } from '@/analytics';
import { fetchScreenRoutes } from '@/api/context';
import {
  OnboardingVoiceContext,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceStatus,
} from '@/contexts/useOnboardingVoiceSession';
import { useRealtimeVoice, type RealtimeVoiceState } from '@/hooks/useRealtimeVoice';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { normalizeCoachingStyle } from '@/lib/coaching/styles';
import { buildContextMessage } from '@/lib/context/buildContextMessage';
import { getScreenContext } from '@/lib/context/getScreenContext';
import { screenIdForRoute } from '@/lib/context/screenIdForRoute';
import { queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/stores/authStore';

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

function mapStatus(state: RealtimeVoiceState, ended: boolean): OnboardingVoiceStatus {
  if (state === 'error') return 'error';
  if (state === 'connecting') return 'connecting';
  if (state === 'listening' || state === 'thinking' || state === 'speaking') return 'active';
  return ended ? 'ended' : 'idle';
}

// `onboard_*` prefix → surface='onboarding'. Real screen_id rides in the
// mid-call screen-context message body.
const PROVIDER_SCREEN_TAG = 'onboard_session';

export function OnboardingVoiceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { logEvent } = useSessionLog();
  const { preferences } = useUserPreferences();

  const fallbackLoggedRef = useRef(false);
  const { coachingStyle, fallbackUsed } = useMemo(() => {
    const { style, fallbackUsed } = normalizeCoachingStyle(preferences.coachingStyle);
    return { coachingStyle: style, fallbackUsed };
  }, [preferences.coachingStyle]);

  useEffect(() => {
    if (fallbackUsed && !fallbackLoggedRef.current) {
      fallbackLoggedRef.current = true;
      logEvent('coaching_style_fallback_used', {
        raw_value: preferences.coachingStyle,
      });
    }
  }, [fallbackUsed, preferences.coachingStyle, logEvent]);

  const routesQuery = useQuery({
    queryKey: queryKeys.context.routes(),
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
  });

  const inOnboarding = isOnboardingPath(location.pathname);
  const currentScreenId = useMemo(
    () => screenIdForRoute(routesQuery.data?.routes ?? [], location.pathname),
    [routesQuery.data, location.pathname],
  );

  const [isMuted, setIsMutedState] = useState(true);
  const [isTtsMuted, setIsTtsMutedState] = useState(false);
  const [endedFlag, setEndedFlag] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const lastPushedScreenIdRef = useRef<string | null>(null);
  const lastScreenChangeTsRef = useRef<string | null>(null);
  // Only user-initiated endCall → 'ended'. Route-exit and remote-close stay idle.
  const didCallStopRef = useRef(false);
  const currentScreenIdRef = useRef<string | null>(currentScreenId);
  useEffect(() => {
    currentScreenIdRef.current = currentScreenId;
  }, [currentScreenId]);

  const getClientRef = useRef<() => Vapi | null>(() => null);

  const pushScreenContext = useCallback(
    async (screenId: string, sinceTs: string | null) => {
      const client = getClientRef.current();
      if (!client) return;
      // Set before await — concurrent screen-change effects would race otherwise.
      lastPushedScreenIdRef.current = screenId;
      try {
        const ctx = await getScreenContext(qc, screenId, sinceTs);
        const body = buildContextMessage({
          screen_id: ctx.screen_id,
          context_block: ctx.context_block,
          state_delta: ctx.state_delta,
        });
        client.send({
          type: 'add-message',
          message: { role: 'system', content: body },
          triggerResponseEnabled: true,
        });
        logEvent('screen_context_pushed', { screen_id: screenId, since_ts: sinceTs });
        track('push_screen_context', { screen_id: screenId, since_ts: sinceTs });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to push screen context';
        setProviderError(msg);
      }
    },
    [qc, logEvent],
  );

  const onCallStart = useCallback(() => {
    setEndedFlag(false);
    setProviderError(null);
    lastScreenChangeTsRef.current = new Date().toISOString();
    const sid = currentScreenIdRef.current;
    if (sid) void pushScreenContext(sid, null);
  }, [pushScreenContext]);

  const onEnd = useCallback(() => {
    setIsMutedState(true);
    setIsTtsMutedState(false);
    setEndedFlag(didCallStopRef.current);
    didCallStopRef.current = false;
    lastPushedScreenIdRef.current = null;
    lastScreenChangeTsRef.current = null;
  }, []);

  const onError = useCallback((msg: string) => {
    setProviderError(msg);
  }, []);

  const metadata = useMemo(
    () => ({
      user_id: userId ?? '',
      screen: PROVIDER_SCREEN_TAG,
      coaching_style: coachingStyle,
    }),
    [userId, coachingStyle],
  );

  const {
    state,
    error: realtimeError,
    isSpeaking,
    start,
    stop,
    getClient,
  } = useRealtimeVoice({
    metadata,
    startAudioOff: true,
    onCallStart,
    onEnd,
    onError,
  });

  useEffect(() => {
    getClientRef.current = getClient;
  }, [getClient]);

  const status = mapStatus(state, endedFlag);
  const errorMessage = providerError ?? realtimeError;

  useEffect(() => {
    if (inOnboarding && status === 'idle' && currentScreenId) {
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inOnboarding, status, currentScreenId]);

  useEffect(() => {
    if (!inOnboarding && (status === 'active' || status === 'connecting')) {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inOnboarding, status]);

  useEffect(() => {
    if (status !== 'active' || !currentScreenId) return;
    if (lastPushedScreenIdRef.current === currentScreenId) return;
    const priorTs = lastScreenChangeTsRef.current;
    lastScreenChangeTsRef.current = new Date().toISOString();
    void pushScreenContext(currentScreenId, priorTs);
  }, [status, currentScreenId, pushScreenContext]);

  const setMicEnabled = useCallback(
    (enabled: boolean) => {
      const client = getClient();
      if (client) client.setMuted(!enabled);
      setIsMutedState(!enabled);
    },
    [getClient],
  );

  const setTtsEnabled = useCallback(
    (enabled: boolean) => {
      const client = getClient();
      if (client) {
        client.send({
          type: 'control',
          control: enabled ? 'unmute-assistant' : 'mute-assistant',
        });
      }
      setIsTtsMutedState(!enabled);
    },
    [getClient],
  );

  const toggleMute = useCallback(() => {
    setMicEnabled(isMuted);
  }, [isMuted, setMicEnabled]);

  const endCall = useCallback(() => {
    didCallStopRef.current = true;
    stop();
  }, [stop]);

  const restartCall = useCallback(async () => {
    // Bypass endCall — this intermediate stop isn't a user-end.
    if (status === 'active' || status === 'connecting') stop();
    await start();
  }, [start, stop, status]);

  const value: OnboardingVoiceContextValue = {
    status,
    isMuted,
    isTtsMuted,
    isAssistantSpeaking: isSpeaking,
    errorMessage,
    currentScreenId,
    toggleMute,
    setMicEnabled,
    setTtsEnabled,
    endCall,
    restartCall,
  };

  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}
