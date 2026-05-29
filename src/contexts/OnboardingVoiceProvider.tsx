import { useQueryClient } from '@tanstack/react-query';
import type Vapi from '@vapi-ai/web';
import type { AssistantOverrides } from '@vapi-ai/web/dist/api';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { VoiceCapModal } from '@/components/voice/VoiceCapModal';
import { applyStartThread } from '@/contexts/applyStartThread';
import {
  OnboardingVoiceContext,
  USER_SPEAKING_IDLE_MS,
  type OnboardingTranscriptListener,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceStatus,
  type ParserResultFeedback,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import {
  useRealtimeVoice,
  type RealtimeTranscriptEvent,
  type RealtimeVoiceState,
} from '@/hooks/useRealtimeVoice';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { normalizeCoachingStyle } from '@/lib/coaching/styles';
import { countVapiToday, VAPI_CAP_DISABLED, VAPI_DAILY_CAP } from '@/lib/config/voice';
import { buildContextMessage } from '@/lib/context/buildContextMessage';
import { getScreenContext } from '@/lib/context/getScreenContext';
import { getBundledRoutes } from '@/lib/context/screenContextsBundle';
import { screenIdForRoute } from '@/lib/context/screenIdForRoute';
import { buildAssistantOverrides } from '@/lib/voice/buildAssistantOverrides';
import { useAuthStore } from '@/stores/authStore';
import { useSessionLogStore } from '@/stores/sessionLogStore';
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
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const userActiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const userClosedOverlayRef = useRef(false);
  const prevSettledStatusRef = useRef<OnboardingVoiceStatus>('idle');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const threadScreenIdRef = useRef<string | null>(null);
  const lastAssistantFinalRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

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

  // Form snapshot — updated by each onboarding page via setFormSnapshot.
  // Read by buildOverridesForCall (cold start) and pushScreenContext (screen
  // change), and used to drive a debounced "form state update" add-message
  // when the snapshot changes mid-screen.
  const formSnapshotRef = useRef<Record<string, unknown>>({});
  const formSnapshotPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const FORM_SNAPSHOT_DEBOUNCE_MS = 700;

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
          filled_form_state: formSnapshotRef.current,
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

  // Shallow-compare two snapshot objects so we only re-push to Vapi when
  // something actually changed. Deep equality would matter for nested
  // habitConfigs, but pages typically re-create that object only when its
  // contents change, so referential identity tracks the contents well enough.
  function shallowSnapshotEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  const setFormSnapshot = useCallback((snapshot: Record<string, unknown>) => {
    const next = snapshot ?? {};
    if (shallowSnapshotEqual(formSnapshotRef.current, next)) return;
    formSnapshotRef.current = next;
    if (import.meta.env.DEV) {
      console.debug('[onboarding-voice] form snapshot updated', next);
    }
    // Skip mid-screen reactive push if Vapi isn't connected yet — cold-start
    // overrides will carry the snapshot, and pushScreenContext picks it up
    // on screen change.
    const client = getClientRef.current();
    if (!client) return;
    if (formSnapshotPushTimerRef.current) clearTimeout(formSnapshotPushTimerRef.current);
    formSnapshotPushTimerRef.current = setTimeout(() => {
      formSnapshotPushTimerRef.current = null;
      const c = getClientRef.current();
      if (!c) return;
      const sid =
        lastPushedScreenIdRef.current ??
        activeSubScreenIdRef.current ??
        currentScreenIdRef.current ??
        '';
      // Snapshot-only update — distinct from the full screen-context message
      // so Vapi doesn't treat it as a screen change. triggerResponseEnabled
      // is false so Vapi updates its context silently without speaking after
      // every field fill.
      const lines: string[] = [];
      for (const [k, v] of Object.entries(formSnapshotRef.current)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        if (Array.isArray(v) && v.length === 0) continue;
        if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
          continue;
        const rendered =
          typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : JSON.stringify(v);
        lines.push(`- ${k}: ${rendered}`);
      }
      if (lines.length === 0) return;
      const body = [
        '[FORM STATE UPDATE]',
        `The user has updated form fields on the current screen (${sid}). Latest filled state:`,
        ...lines,
        '(All other screen context unchanged — do not greet again or change screens.)',
      ].join('\n');
      c.send({
        type: 'add-message',
        message: { role: 'system', content: body },
        triggerResponseEnabled: false,
      });
    }, FORM_SNAPSHOT_DEBOUNCE_MS);
  }, []);

  // Feedback channel from the /api/process-command parser back to Vapi.
  // After each user utterance we run the parser; this tells Vapi how it
  // went so Vapi can acknowledge cleanly on success or ask the user to
  // repeat clearly on failure.
  //
  // Truncates the transcript to 200 chars so a long brain-dump on the
  // advanced flow doesn't bloat the system message stream.
  const notifyParserResult = useCallback((result: ParserResultFeedback) => {
    const client = getClientRef.current();
    if (!client) return;
    const transcript = result.transcript.slice(0, 200);
    const body = result.ok
      ? [
          `[PARSER OK]`,
          `The user said: "${transcript}".`,
          `I extracted action=${result.action} with params ${JSON.stringify(result.params)}.`,
          `The form is now updated. In your next turn, acknowledge naturally (e.g. "Got it" or by referencing the value), then move on to the next unfilled field — do NOT re-ask for this one.`,
        ].join('\n')
      : [
          `[PARSER MISS]`,
          `The user said: "${transcript}".`,
          `I could not extract a clear form value (reason: ${result.reason}).`,
          `If you believe they intended to fill a field on this screen, ask them to repeat the value clearly in one short sentence. Otherwise continue the conversation naturally — do NOT mention "parser" or any technical issue to the user.`,
        ].join('\n');
    client.send({
      type: 'add-message',
      message: { role: 'system', content: body },
      triggerResponseEnabled: false,
    });
    if (import.meta.env.DEV) {
      console.debug('[onboarding-voice] notifyParserResult', result.ok ? 'OK' : 'MISS', {
        transcript,
      });
    }
  }, []);

  // Force-flush the pending debounced snapshot push immediately. Called by
  // OnboardingLayout right after the parser dispatches a definitive form
  // action — without this, Vapi only learns about the change 700ms later
  // (after the debounce), which can be AFTER Vapi has already formulated a
  // response that re-asks for the just-filled field.
  const flushFormSnapshot = useCallback(() => {
    const client = getClientRef.current();
    if (!client) return;
    if (formSnapshotPushTimerRef.current) {
      clearTimeout(formSnapshotPushTimerRef.current);
      formSnapshotPushTimerRef.current = null;
    }
    const sid =
      lastPushedScreenIdRef.current ??
      activeSubScreenIdRef.current ??
      currentScreenIdRef.current ??
      '';
    const lines: string[] = [];
    for (const [k, v] of Object.entries(formSnapshotRef.current)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) {
        continue;
      }
      const rendered =
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
          ? String(v)
          : JSON.stringify(v);
      lines.push(`- ${k}: ${rendered}`);
    }
    if (lines.length === 0) return;
    const body = [
      '[FORM STATE UPDATE — immediate, parser-dispatched]',
      `The user's last utterance filled a form field. Updated snapshot for ${sid}:`,
      ...lines,
      'Acknowledge naturally in your next turn (do not re-ask for these). Other screen context unchanged.',
    ].join('\n');
    client.send({
      type: 'add-message',
      message: { role: 'system', content: body },
      triggerResponseEnabled: false,
    });
    if (import.meta.env.DEV) {
      console.debug('[onboarding-voice] flushFormSnapshot (immediate)', sid);
    }
  }, []);

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

  // Pushes a snapshot-only system message — same renderer as the mid-screen
  // debounced push, but synchronous at call time. Used by onCallStart as a
  // safety net when the cold-start variableValues path can't be relied on
  // (i.e. the dashboard prompt doesn't include {{initial_screen_context}}).
  const pushFormSnapshotMessage = useCallback((sid: string) => {
    const client = getClientRef.current();
    if (!client) return;
    const lines: string[] = [];
    for (const [k, v] of Object.entries(formSnapshotRef.current)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) {
        continue;
      }
      const rendered =
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
          ? String(v)
          : JSON.stringify(v);
      lines.push(`- ${k}: ${rendered}`);
    }
    if (lines.length === 0) return;
    const body = [
      '[FORM STATE — initial snapshot for this screen]',
      `Screen: ${sid}. The user has these values already entered (treat as KNOWN; do NOT re-ask, DO use them — e.g. greet by nickname if filled):`,
      ...lines,
      '(All other screen context unchanged.)',
    ].join('\n');
    client.send({
      type: 'add-message',
      message: { role: 'system', content: body },
      triggerResponseEnabled: false,
    });
    if (import.meta.env.DEV) {
      console.debug('[onboarding-voice] cold-start snapshot add-message sent', sid);
    }
  }, []);

  const onCallStart = useCallback(() => {
    setEndedFlag(false);
    setProviderError(null);
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    clearRetryTimer();
    setMessages([]);
    threadScreenIdRef.current = null;
    lastAssistantFinalRef.current = { text: '', at: 0 };
    const sid = activeSubScreenIdRef.current ?? currentScreenIdRef.current;
    // If we already injected the screen context via assistantOverrides at
    // vapi.start() (the cold-start path), skip the redundant context push —
    // Vapi would fire a second turn-0 response and stutter the opening.
    // But ALSO send a snapshot-only add-message with triggerResponseEnabled
    // false so the FORM STATE block lands as a system message regardless of
    // whether the dashboard prompt contains the {{initial_screen_context}}
    // placeholder (variable substitution silently drops when placeholder is
    // missing — the snapshot would otherwise never reach Vapi on cold start).
    if (sid && lastPushedScreenIdRef.current !== sid) {
      lastScreenChangeTsRef.current = new Date().toISOString();
      void pushScreenContext(sid, null);
    } else if (sid) {
      pushFormSnapshotMessage(sid);
    }
  }, [pushScreenContext, clearRetryTimer, pushFormSnapshotMessage]);

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
    if (evt.role === 'user') {
      if (evt.kind === 'partial') {
        if (userActiveTimerRef.current) clearTimeout(userActiveTimerRef.current);
        setIsUserSpeaking(true);
        userActiveTimerRef.current = setTimeout(() => {
          userActiveTimerRef.current = null;
          setIsUserSpeaking(false);
        }, USER_SPEAKING_IDLE_MS);
      } else {
        if (userActiveTimerRef.current) {
          clearTimeout(userActiveTimerRef.current);
          userActiveTimerRef.current = null;
        }
        setIsUserSpeaking(false);
      }
    }
    if (evt.kind === 'final') {
      const text = evt.text.trim();
      if (text) {
        const now = Date.now();
        let skip = false;
        if (evt.role === 'assistant') {
          if (
            lastAssistantFinalRef.current.text === text &&
            now - lastAssistantFinalRef.current.at < 1500
          ) {
            skip = true;
          } else {
            lastAssistantFinalRef.current = { text, at: now };
          }
        }
        if (!skip) {
          setMessages((prev) => [
            ...prev,
            {
              id: `vapi-${evt.role}-${now}`,
              role: evt.role === 'assistant' ? 'ai' : 'user',
              text,
            },
          ]);
        }
      }
    }
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

  // Per-call override builder — fires inside useRealtimeVoice.start() right
  // before vapi.start(). Injects the current screen's context_block + recent
  // state_delta as a system message and flips firstMessageMode so the model
  // generates the opening from that context (instead of the static dashboard
  // firstMessage greeting). Pre-seeds lastPushedScreenIdRef so onCallStart
  // skips the now-redundant add-message push.
  const buildOverridesForCall = useCallback(async (): Promise<
    Partial<AssistantOverrides> | undefined
  > => {
    const sid = activeSubScreenIdRef.current ?? currentScreenIdRef.current;
    if (!sid) return undefined;
    try {
      const ctx = await getScreenContext(qc, sid, null);
      if (import.meta.env.DEV) {
        console.debug(
          '[onboarding-voice] cold start — filledFormState',
          formSnapshotRef.current,
          'stateDelta count',
          ctx.state_delta.length,
        );
      }
      const overrides = buildAssistantOverrides({
        screenId: ctx.screen_id,
        contextBlock: ctx.context_block,
        stateDelta: ctx.state_delta,
        filledFormState: formSnapshotRef.current,
      });
      lastPushedScreenIdRef.current = sid;
      lastScreenChangeTsRef.current = new Date().toISOString();
      // session_log event types are enum-gated; PostHog handles the
      // visibility for this one — no need to grow the enum.
      track('vapi_overrides_applied', {
        screen_id: sid,
        delta_count: ctx.state_delta.length,
      });
      return overrides as unknown as Partial<AssistantOverrides>;
    } catch (err) {
      console.warn(
        '[onboarding-voice] buildAssistantOverrides failed, falling back to dashboard firstMessage:',
        err,
      );
      return undefined;
    }
  }, [qc]);

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
    getAssistantOverrides: buildOverridesForCall,
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
      if (remoteEndCooldownTimerRef.current !== null)
        clearTimeout(remoteEndCooldownTimerRef.current);
      if (userActiveTimerRef.current !== null) clearTimeout(userActiveTimerRef.current);
    };
  }, []);

  const status = mapStatus(state, endedFlag);
  const errorMessage = providerError ?? realtimeError;

  useEffect(() => {
    if (status !== 'active') {
      if (userActiveTimerRef.current !== null) {
        clearTimeout(userActiveTimerRef.current);
        userActiveTimerRef.current = null;
      }
      setIsUserSpeaking(false);
    }
  }, [status]);

  useEffect(() => {
    // Skip the transient 'connecting' phase so we don't churn the ref on
    // every retry. All terminal/settled statuses (idle/active/ended/error)
    // update prev so toggle-off → toggle-on cycles transition correctly.
    if (status === 'connecting') return;
    const prev = prevSettledStatusRef.current;
    if (prev !== 'active' && status === 'active') {
      if (!userClosedOverlayRef.current) setOverlayOpen(true);
    } else if (prev === 'active' && status !== 'active') {
      // ANY exit from active — including 'idle' (DualButton toggle-off, which
      // does NOT route through endCall and therefore doesn't set endedFlag).
      // Previously this branch was gated to ended/error only; that left the
      // overlay open after a mic/voice toggle-off and trapped prev='active'
      // so the next toggle-on couldn't reopen.
      setOverlayOpen(false);
      userClosedOverlayRef.current = false;
    }
    prevSettledStatusRef.current = status;
  }, [status]);

  const openOverlay = useCallback(() => {
    userClosedOverlayRef.current = false;
    setOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    userClosedOverlayRef.current = true;
    setOverlayOpen(false);
  }, []);

  const appendMessage = useCallback((msg: VoiceMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const startThread = useCallback(
    (
      screenId: string,
      initial: VoiceMessage[],
      mode: 'replace' | 'append-if-empty' = 'replace',
    ) => {
      if (threadScreenIdRef.current === screenId) return;
      threadScreenIdRef.current = screenId;
      setMessages((prev) => applyStartThread(prev, initial, mode));
    },
    [],
  );

  const [vapiToday, setVapiToday] = useState(() =>
    countVapiToday(useSessionLogStore.getState().events),
  );
  useEffect(() => {
    return useSessionLogStore.subscribe((s) => setVapiToday(countVapiToday(s.events)));
  }, []);
  const voiceCapReached = !VAPI_CAP_DISABLED && vapiToday >= VAPI_DAILY_CAP;
  const [capDismissed, setCapDismissed] = useState(false);
  const dismissVoiceCap = useCallback(() => setCapDismissed(true), []);

  const capLoggedDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceCapReached) return;
    const today = new Date().toDateString();
    if (capLoggedDateRef.current === today) return;
    capLoggedDateRef.current = today;
    logEvent('voice_cap_reached', { count: vapiToday, limit: VAPI_DAILY_CAP });
    track('voice_cap_reached', { count: vapiToday, limit: VAPI_DAILY_CAP });
  }, [voiceCapReached, vapiToday, logEvent]);

  const vapiShouldBeLive =
    inOnboarding &&
    preferences.voiceMode === 'voice' &&
    preferences.micEnabled === true &&
    preferences.micPermission === true &&
    !!currentScreenId &&
    !fatalErrorRef.current &&
    !remoteEndCooldown &&
    !voiceCapReached;

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
      if (status !== 'active' && status !== 'connecting' && pendingRef.current !== 'starting') {
        return;
      }
      pendingRef.current = 'stopping';
      didCallStopRef.current = true;
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
      if (pendingRef.current !== null) return;
      useVoiceSettingsStore.getState().systemPauseMic();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer]);

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
      isUserSpeaking,
      errorMessage,
      currentScreenId: activeSubScreenId ?? currentScreenId,
      overlayOpen,
      openOverlay,
      closeOverlay,
      messages,
      appendMessage,
      startThread,
      endCall,
      restartCall,
      pushSubScreen,
      setFormSnapshot,
      flushFormSnapshot,
      notifyParserResult,
      subscribeTranscripts,
      voiceCapReached: voiceCapReached && !capDismissed && inOnboarding,
      dismissVoiceCap,
    }),
    [
      status,
      isSpeaking,
      isUserSpeaking,
      errorMessage,
      activeSubScreenId,
      currentScreenId,
      overlayOpen,
      openOverlay,
      closeOverlay,
      messages,
      appendMessage,
      startThread,
      endCall,
      restartCall,
      pushSubScreen,
      setFormSnapshot,
      flushFormSnapshot,
      notifyParserResult,
      subscribeTranscripts,
      voiceCapReached,
      capDismissed,
      inOnboarding,
      dismissVoiceCap,
    ],
  );

  return (
    <OnboardingVoiceContext.Provider value={value}>
      {children}
      <VoiceCapModal />
    </OnboardingVoiceContext.Provider>
  );
}
