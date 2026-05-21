import { useQueryClient } from '@tanstack/react-query';
import type Vapi from '@vapi-ai/web';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import {
  OnboardingVoiceContext,
  type OnboardingTranscriptListener,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceStatus,
} from '@/contexts/useOnboardingVoiceSession';
import {
  useRealtimeVoice,
  type RealtimeTranscriptEvent,
  type RealtimeVoiceState,
} from '@/hooks/useRealtimeVoice';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { normalizeCoachingStyle } from '@/lib/coaching/styles';
import { buildContextMessage } from '@/lib/context/buildContextMessage';
import { getScreenContext } from '@/lib/context/getScreenContext';
import { getBundledRoutes } from '@/lib/context/screenContextsBundle';
import { screenIdForRoute } from '@/lib/context/screenIdForRoute';
import { useAuthStore } from '@/stores/authStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFFS_MS = [2000, 5000];
const IDLE_TIMEOUT_MS = 8000;
const REMOTE_END_COOLDOWN_MS = 3000;

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
  const anonId = useAuthStore((s) => s.anonId);
  const { logEvent } = useSessionLog();
  const { preferences, updatePreferences } = useUserPreferences();

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

  const bundledRoutes = useMemo(() => getBundledRoutes(), []);

  const inOnboarding = isOnboardingPath(location.pathname);
  const currentScreenId = useMemo(
    () => screenIdForRoute(bundledRoutes, location.pathname),
    [bundledRoutes, location.pathname],
  );

  const [endedFlag, setEndedFlag] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [remoteEndCooldown, setRemoteEndCooldown] = useState(false);

  const lastPushedScreenIdRef = useRef<string | null>(null);
  const lastScreenChangeTsRef = useRef<string | null>(null);
  const [activeSubScreenId, setActiveSubScreenId] = useState<string | null>(null);
  const activeSubScreenIdRef = useRef<string | null>(null);
  const didCallStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fatalErrorRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteEndCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAssistantSpokenRef = useRef(false);
  const transcriptListenersRef = useRef<Set<OnboardingTranscriptListener>>(new Set());
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const getClientRef = useRef<() => Vapi | null>(() => null);
  const currentScreenIdRef = useRef<string | null>(currentScreenId);
  useEffect(() => {
    currentScreenIdRef.current = currentScreenId;
  }, [currentScreenId]);

  const pendingRef = useRef<'starting' | 'stopping' | null>(null);
  const lastTransitionRef = useRef<Promise<unknown> | null>(null);
  const vapiShouldBeLiveRef = useRef(false);

  const pushScreenContext = useCallback(
    async (screenId: string, sinceTs: string | null) => {
      const client = getClientRef.current();
      if (!client) return;
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

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearRemoteEndCooldownTimer = useCallback(() => {
    if (remoteEndCooldownTimerRef.current !== null) {
      clearTimeout(remoteEndCooldownTimerRef.current);
      remoteEndCooldownTimerRef.current = null;
    }
  }, []);

  const onCallStart = useCallback(() => {
    setEndedFlag(false);
    setProviderError(null);
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    clearRetryTimer();
    lastScreenChangeTsRef.current = new Date().toISOString();
    const sid = activeSubScreenIdRef.current ?? currentScreenIdRef.current;
    if (sid) void pushScreenContext(sid, null);
  }, [pushScreenContext, clearRetryTimer]);

  const onEnd = useCallback(() => {
    const userInitiated = didCallStopRef.current;
    setEndedFlag(userInitiated);
    didCallStopRef.current = false;
    lastPushedScreenIdRef.current = null;
    lastScreenChangeTsRef.current = null;
    if (!userInitiated) {
      setRemoteEndCooldown(true);
      clearRemoteEndCooldownTimer();
      remoteEndCooldownTimerRef.current = setTimeout(() => {
        remoteEndCooldownTimerRef.current = null;
        setRemoteEndCooldown(false);
      }, REMOTE_END_COOLDOWN_MS);
    }
  }, [clearRemoteEndCooldownTimer]);

  const onError = useCallback(
    (msg: string) => {
      setProviderError(msg);
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
        if (!vapiShouldBeLiveRef.current) return;
        void startRef.current?.();
      }, delay);
    },
    [clearRetryTimer],
  );

  const metadata = useMemo(
    () => ({
      anon_id: anonId ?? '',
      screen: PROVIDER_SCREEN_TAG,
      coaching_style: coachingStyle,
    }),
    [anonId, coachingStyle],
  );

  const armIdleTimerRef = useRef<() => void>(() => {});

  const handleUserActivity = useCallback(() => {
    if (idleTimerRef.current !== null) armIdleTimerRef.current();
  }, []);

  const handleTranscript = useCallback((evt: RealtimeTranscriptEvent) => {
    for (const listener of transcriptListenersRef.current) {
      try {
        listener(evt);
      } catch (err) {
        console.warn('[onboarding-voice] transcript listener threw:', err);
      }
    }
  }, []);

  const subscribeTranscripts = useCallback((listener: OnboardingTranscriptListener) => {
    transcriptListenersRef.current.add(listener);
    return () => {
      transcriptListenersRef.current.delete(listener);
    };
  }, []);

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
    onUserActivity: handleUserActivity,
    onTranscript: handleTranscript,
  });

  useEffect(() => {
    getClientRef.current = getClient;
  }, [getClient]);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    activeSubScreenIdRef.current = activeSubScreenId;
  }, [activeSubScreenId]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      if (remoteEndCooldownTimerRef.current !== null) clearTimeout(remoteEndCooldownTimerRef.current);
    };
  }, []);

  const status = mapStatus(state, endedFlag);
  const errorMessage = providerError ?? realtimeError;

  const vapiShouldBeLive =
    inOnboarding &&
    preferences.voiceMode === 'voice' &&
    preferences.micEnabled === true &&
    preferences.micPermission === true &&
    !!currentScreenId &&
    !fatalErrorRef.current &&
    !remoteEndCooldown;

  useEffect(() => {
    vapiShouldBeLiveRef.current = vapiShouldBeLive;
  }, [vapiShouldBeLive]);

  useEffect(() => {
    if (vapiShouldBeLive) {
      if (status === 'active' || status === 'connecting' || pendingRef.current === 'starting') {
        return;
      }
      pendingRef.current = 'starting';
      const prev = lastTransitionRef.current;
      lastTransitionRef.current = Promise.resolve(prev)
        .then(() => start())
        .finally(() => {
          if (pendingRef.current === 'starting') pendingRef.current = null;
        });
    } else {
      if (
        status !== 'active' &&
        status !== 'connecting' &&
        pendingRef.current !== 'starting'
      ) {
        return;
      }
      pendingRef.current = 'stopping';
      const prev = lastTransitionRef.current;
      lastTransitionRef.current = Promise.resolve(prev)
        .then(() => stop())
        .finally(() => {
          if (pendingRef.current === 'stopping') pendingRef.current = null;
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vapiShouldBeLive, status]);

  useEffect(() => {
    if (!inOnboarding) {
      clearRetryTimer();
      clearRemoteEndCooldownTimer();
      retryCountRef.current = 0;
      fatalErrorRef.current = false;
      setRemoteEndCooldown(false);
      setActiveSubScreenId(null);
    }
  }, [inOnboarding, clearRetryTimer, clearRemoteEndCooldownTimer]);

  useEffect(() => {
    if (isSpeaking) hasAssistantSpokenRef.current = true;
  }, [isSpeaking]);

  useEffect(() => {
    if (status !== 'active' && status !== 'connecting') {
      hasAssistantSpokenRef.current = false;
    }
  }, [status]);

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      void updatePreferences({ voiceMode: 'screen', micEnabled: false });
      useVoiceSettingsStore.getState().hydrate({ ttsEnabled: false, micEnabled: false });
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, updatePreferences]);

  useEffect(() => {
    armIdleTimerRef.current = armIdleTimer;
  }, [armIdleTimer]);

  useEffect(() => {
    if (status !== 'active' || state !== 'listening' || !hasAssistantSpokenRef.current) {
      clearIdleTimer();
      return;
    }
    armIdleTimer();
    return clearIdleTimer;
  }, [status, state, clearIdleTimer, armIdleTimer]);

  useEffect(() => {
    if (status !== 'active') return;
    const screenToFetch = activeSubScreenId ?? currentScreenId;
    if (!screenToFetch) return;
    if (lastPushedScreenIdRef.current === screenToFetch) return;
    const priorTs = lastScreenChangeTsRef.current;
    lastScreenChangeTsRef.current = new Date().toISOString();
    void pushScreenContext(screenToFetch, priorTs);
  }, [status, currentScreenId, activeSubScreenId, pushScreenContext]);

  const pushSubScreen = useCallback((screenId: string | null) => {
    if (screenId === null) {
      if (activeSubScreenIdRef.current === null) return;
      activeSubScreenIdRef.current = null;
      setActiveSubScreenId(null);
      return;
    }
    if (activeSubScreenIdRef.current === screenId) return;
    activeSubScreenIdRef.current = screenId;
    setActiveSubScreenId(screenId);
  }, []);

  const endCall = useCallback(() => {
    didCallStopRef.current = true;
    void updatePreferences({ voiceMode: 'screen', micEnabled: false });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: false, micEnabled: false });
  }, [updatePreferences]);

  const restartCall = useCallback(async () => {
    clearRetryTimer();
    clearRemoteEndCooldownTimer();
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    setRemoteEndCooldown(false);
    setProviderError(null);
    await updatePreferences({ voiceMode: 'voice', micEnabled: true });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: true, micEnabled: true });
  }, [clearRetryTimer, clearRemoteEndCooldownTimer, updatePreferences]);

  const value = useMemo<OnboardingVoiceContextValue>(
    () => ({
      status,
      isAssistantSpeaking: isSpeaking,
      errorMessage,
      currentScreenId: activeSubScreenId ?? currentScreenId,
      endCall,
      restartCall,
      pushSubScreen,
      subscribeTranscripts,
    }),
    [
      status,
      isSpeaking,
      errorMessage,
      activeSubScreenId,
      currentScreenId,
      endCall,
      restartCall,
      pushSubScreen,
      subscribeTranscripts,
    ],
  );

  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}
