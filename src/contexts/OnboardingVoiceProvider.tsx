import { useQuery, useQueryClient } from '@tanstack/react-query';
import type Vapi from '@vapi-ai/web';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFFS_MS = [2000, 5000];

// Errors that won't be fixed by retrying. 429 = rate/quota; 401/403 = bad
// credentials; 400 = bad request (assistant config). Hammering only makes
// it worse, so we go straight to the dead-inside state.
function isFatalVapiError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('too many requests') ||
    m.includes('401') ||
    m.includes('403') ||
    m.includes('400') ||
    m.includes('unauthorized') ||
    m.includes('forbidden')
  );
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
  // Non-null while an overlay (e.g. habit-customize sheet) owns the context.
  // Gates the route-driven push so the route's screen doesn't clobber the
  // overlay's while the sheet is open. Mirror in a ref for synchronous reads
  // from pushSubScreen so a no-op revert on mount doesn't trample state.
  const [activeSubScreenId, setActiveSubScreenId] = useState<string | null>(null);
  const activeSubScreenIdRef = useRef<string | null>(null);
  // Only user-initiated endCall → 'ended'. Route-exit and remote-close stay idle.
  const didCallStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fatalErrorRef = useRef(false);
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const currentScreenIdRef = useRef<string | null>(currentScreenId);
  useEffect(() => {
    currentScreenIdRef.current = currentScreenId;
  }, [currentScreenId]);

  const getClientRef = useRef<() => Vapi | null>(() => null);
  // Once-per-screen auto-start gate. Prevents an infinite restart loop when
  // Vapi ends a call remotely (state goes back to 'idle' → auto-start effect
  // would otherwise re-fire). Distinct from `fatalErrorRef`, which guards the
  // 429/auth retry storm. Resets on screen change so each onboarding step
  // gets a fresh attempt.
  const startAttemptedRef = useRef(false);

  useEffect(() => {
    startAttemptedRef.current = false;
  }, [currentScreenId]);

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

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const onCallStart = useCallback(() => {
    setEndedFlag(false);
    setProviderError(null);
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    clearRetryTimer();
    lastScreenChangeTsRef.current = new Date().toISOString();
    // Prefer the sub-screen if one is active — covers the case where the user
    // had a bottom-sheet open when the call dropped/retried. Without this, the
    // reconnect would push the underlying route's screen and the LLM would
    // think the sheet isn't open.
    const sid = activeSubScreenIdRef.current ?? currentScreenIdRef.current;
    if (sid) void pushScreenContext(sid, null);
  }, [pushScreenContext, clearRetryTimer]);

  const onEnd = useCallback(() => {
    setIsMutedState(true);
    setIsTtsMutedState(false);
    setEndedFlag(didCallStopRef.current);
    didCallStopRef.current = false;
    lastPushedScreenIdRef.current = null;
    lastScreenChangeTsRef.current = null;
  }, []);

  const onError = useCallback(
    (msg: string) => {
      setProviderError(msg);
      // Don't retry fatal errors (rate-limit, auth, bad request) — retrying
      // just deepens the problem. Once retries are exhausted, stay dead.
      if (isFatalVapiError(msg) || retryCountRef.current >= MAX_AUTO_RETRIES) {
        fatalErrorRef.current = true;
        clearRetryTimer();
        return;
      }
      const delay = RETRY_BACKOFFS_MS[retryCountRef.current] ?? 5000;
      retryCountRef.current += 1;
      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void startRef.current?.();
      }, delay);
    },
    [clearRetryTimer],
  );

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

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Keep the activeSubScreenId ref in sync with state so pushSubScreen's
  // synchronous read sees the current value even if other code paths mutate
  // the state directly (today only pushSubScreen does, but this is defensive).
  useEffect(() => {
    activeSubScreenIdRef.current = activeSubScreenId;
  }, [activeSubScreenId]);

  // Clear any pending retry on unmount so a timer can't fire after teardown.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const status = mapStatus(state, endedFlag);
  const errorMessage = providerError ?? realtimeError;

  useEffect(() => {
    if (
      inOnboarding &&
      status === 'idle' &&
      currentScreenId &&
      !fatalErrorRef.current &&
      !startAttemptedRef.current
    ) {
      startAttemptedRef.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inOnboarding, status, currentScreenId]);

  useEffect(() => {
    if (!inOnboarding) {
      // Reset retry policy when leaving onboarding — next entry starts fresh.
      clearRetryTimer();
      retryCountRef.current = 0;
      fatalErrorRef.current = false;
      startAttemptedRef.current = false;
      setActiveSubScreenId(null);
      if (status === 'active' || status === 'connecting') {
        stop();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inOnboarding, status]);

  // Single push effect: whenever the call is active, push whichever screen
  // is currently active (sub-screen takes precedence over route). This handles
  // three timing cases at once:
  //   1. Route change while call is active           -> currentScreenId changes
  //   2. Sub-screen opens/closes/advances            -> activeSubScreenId changes
  //   3. Call reconnects after error/drop            -> status flips to active,
  //      and since onEnd clears lastPushedScreenIdRef, this re-pushes whichever
  //      screen the user is on (including a sub-screen still open mid-error).
  useEffect(() => {
    if (status !== 'active') return;
    const screenToFetch = activeSubScreenId ?? currentScreenId;
    if (!screenToFetch) return;
    if (lastPushedScreenIdRef.current === screenToFetch) return;
    const priorTs = lastScreenChangeTsRef.current;
    lastScreenChangeTsRef.current = new Date().toISOString();
    void pushScreenContext(screenToFetch, priorTs);
  }, [status, currentScreenId, activeSubScreenId, pushScreenContext]);

  // Just records intent — the unified effect above does the actual push. This
  // means pushSubScreen called before the call is active (status='connecting')
  // still gets honored: when status flips to 'active', the effect picks up
  // the sub-screen instead of the route screen.
  const pushSubScreen = useCallback((screenId: string | null) => {
    if (screenId === null) {
      // Step5 calls this on mount before the sheet has ever opened; guard
      // against the spurious revert.
      if (activeSubScreenIdRef.current === null) return;
      activeSubScreenIdRef.current = null;
      setActiveSubScreenId(null);
      return;
    }
    if (activeSubScreenIdRef.current === screenId) return;
    activeSubScreenIdRef.current = screenId;
    setActiveSubScreenId(screenId);
  }, []);

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
    // User-initiated retry resets the auto-retry budget and clears the
    // dead-inside flag so the auto-start effect can pick up again if needed.
    clearRetryTimer();
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    setProviderError(null);
    // Bypass endCall — this intermediate stop isn't a user-end.
    if (status === 'active' || status === 'connecting') stop();
    await start();
  }, [start, stop, status, clearRetryTimer]);

  const value = useMemo<OnboardingVoiceContextValue>(
    () => ({
      status,
      isMuted,
      isTtsMuted,
      isAssistantSpeaking: isSpeaking,
      errorMessage,
      currentScreenId: activeSubScreenId ?? currentScreenId,
      toggleMute,
      setMicEnabled,
      setTtsEnabled,
      endCall,
      restartCall,
      pushSubScreen,
    }),
    [
      status,
      isMuted,
      isTtsMuted,
      isSpeaking,
      errorMessage,
      activeSubScreenId,
      currentScreenId,
      toggleMute,
      setMicEnabled,
      setTtsEnabled,
      endCall,
      restartCall,
      pushSubScreen,
    ],
  );

  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}
