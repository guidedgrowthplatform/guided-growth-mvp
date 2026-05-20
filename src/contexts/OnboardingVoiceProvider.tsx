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

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFFS_MS = [2000, 5000];
const IDLE_TIMEOUT_MS = 8000;

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

  // Routes come from the bundled JSON — no network round-trip needed. The
  // sessionLogStore + bundled context blocks make screen_id resolution and
  // context lookup fully synchronous during Vapi onboarding navigation.
  const bundledRoutes = useMemo(() => getBundledRoutes(), []);

  const inOnboarding = isOnboardingPath(location.pathname);
  const currentScreenId = useMemo(
    () => screenIdForRoute(bundledRoutes, location.pathname),
    [bundledRoutes, location.pathname],
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
  // Auto-stop the call after IDLE_TIMEOUT_MS of pure 'listening' — caps Vapi
  // session minutes when the user wanders off. Speaking/thinking turns rearm
  // the timer via the dep array of the effect below. User-side talking re-
  // arms it via onUserActivity, since Vapi's speech events are assistant-only.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Warm-up gate: the very first 'listening' window is the assistant booting
  // up + LLM cold-start, NOT user idleness. Skip the idle timer until the
  // assistant has spoken at least once so we don't kill the call before it
  // can greet the user. Reset when the call ends.
  const hasAssistantSpokenRef = useRef(false);
  // Transcript fan-out — listeners come and go with the chat overlay. Set is
  // mutated directly so subscribe/unsubscribe don't trigger re-renders here;
  // re-renders happen only inside the listener (the overlay), which is the
  // right blast radius.
  const transcriptListenersRef = useRef<Set<OnboardingTranscriptListener>>(new Set());
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

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
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
      anon_id: anonId ?? '',
      screen: PROVIDER_SCREEN_TAG,
      coaching_style: coachingStyle,
    }),
    [anonId, coachingStyle],
  );

  // Forward reference for armIdleTimer — it's defined after useRealtimeVoice
  // (which it needs `stop` from), but the user-activity callback below must
  // be wired in *before* useRealtimeVoice. A ref breaks the temporal cycle.
  const armIdleTimerRef = useRef<() => void>(() => {});

  // User-side transcript = real activity. Re-arm only when the timer is
  // currently armed; the effect below owns initial arming/disarming based on
  // call state, so we don't want to spuriously arm from a stray event during
  // the warm-up or assistant-speaking windows.
  //
  // INVARIANT: keep this callback's dep array empty. The Vapi message handler
  // in useRealtimeVoice captures this reference at start() time; if it churned,
  // the live call would keep firing the stale closure. The armIdleTimerRef
  // indirection is what lets us stay stable while still calling the latest
  // armIdleTimer (whose deps DO change).
  const handleUserActivity = useCallback(() => {
    if (idleTimerRef.current !== null) armIdleTimerRef.current();
  }, []);

  // Stable: never recreated. Iterates the listener Set live, so subscribers
  // registered just before a transcript fires still get it.
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

  // Vapi session lifecycle is owned by the LEFT orb (voiceMode) only. The mic
  // orb is mute-only — it controls a runtime track on an already-live session
  // and never starts or tears down the connection. So "voice off" alone is
  // the gate, not "both orbs off".
  const voiceOff = preferences.voiceMode !== 'voice';

  useEffect(() => {
    if (
      inOnboarding &&
      !voiceOff &&
      status === 'idle' &&
      currentScreenId &&
      !fatalErrorRef.current &&
      !startAttemptedRef.current
    ) {
      startAttemptedRef.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inOnboarding, voiceOff, status, currentScreenId]);

  // Mark assistant-has-spoken on the first speech-start. Read by the idle
  // effect below to gate the warm-up window.
  useEffect(() => {
    if (isSpeaking) hasAssistantSpokenRef.current = true;
  }, [isSpeaking]);

  // Reset the warm-up gate whenever the call leaves 'active' so the next
  // session gets a fresh grace window.
  useEffect(() => {
    if (status !== 'active' && status !== 'connecting') {
      hasAssistantSpokenRef.current = false;
    }
  }, [status]);

  // Arm the idle timer with a fresh 8s budget. Stop fires `stop()` and flips
  // ONLY voiceMode — mic preference is the user's call and stays untouched.
  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      void updatePreferences({ voiceMode: 'screen' });
      stop();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, stop, updatePreferences]);

  // Keep the forward reference in sync so handleUserActivity always calls the
  // latest armIdleTimer (which closes over the current stop / updatePreferences).
  useEffect(() => {
    armIdleTimerRef.current = armIdleTimer;
  }, [armIdleTimer]);

  // Idle-stop. Arms only when the call is in true user-silence: active call,
  // currently 'listening', AND the assistant has already greeted at least
  // once. Skipping the pre-greeting window prevents the timer from killing
  // the call during LLM cold-start. didCallStopRef stays false → onEnd lands
  // in 'idle'. State transitions (speaking → listening) re-fire the effect
  // and re-arm. Mid-utterance user pauses re-arm via handleUserActivity below.
  useEffect(() => {
    if (status !== 'active' || state !== 'listening' || !hasAssistantSpokenRef.current) {
      clearIdleTimer();
      return;
    }
    armIdleTimer();
    return clearIdleTimer;
  }, [status, state, clearIdleTimer, armIdleTimer]);

  // Clear retry timer too — its callback bypasses the auto-start gate.
  useEffect(() => {
    if (!inOnboarding) return;
    if (!voiceOff) return;
    clearRetryTimer();
    retryCountRef.current = 0;
    startAttemptedRef.current = false;
    if (status === 'active' || status === 'connecting') {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inOnboarding, voiceOff, status]);

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
      subscribeTranscripts,
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
      subscribeTranscripts,
    ],
  );

  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}
