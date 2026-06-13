import { useQueryClient } from '@tanstack/react-query';
import type Vapi from '@vapi-ai/web';
import type { AssistantOverrides } from '@vapi-ai/web/dist/api';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { OnboardingChatOverlay } from '@/components/onboarding/OnboardingChatOverlay';
import { VoiceCapModal } from '@/components/voice/VoiceCapModal';
import { applyStartThread } from '@/contexts/applyStartThread';
import {
  OnboardingVoiceContext,
  USER_SPEAKING_IDLE_MS,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceResult,
  type OnboardingVoiceStatus,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import {
  useRealtimeVoice,
  type RealtimeTranscriptEvent,
  type RealtimeVoiceState,
} from '@/hooks/useRealtimeVoice';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { normalizeCoachingStyle } from '@/lib/coaching/styles';
import {
  countVapiToday,
  VOICE_IN_ENABLED,
  VAPI_CAP_DISABLED,
  VAPI_DAILY_CAP,
} from '@/lib/config/voice';
import { buildContextMessage } from '@/lib/context/buildContextMessage';
import { getScreenContext } from '@/lib/context/getScreenContext';
import { getBundledRoutes } from '@/lib/context/screenContextsBundle';
import { screenIdForRoute } from '@/lib/context/screenIdForRoute';
import { orbStateFrom } from '@/lib/orb/orbState';
import { startKeyWarmLoop, stopKeyWarmLoop } from '@/lib/services/soniox-temp-key-cache';
import { createListenerBus } from '@/lib/util/listenerBus';
import { buildAssistantOverrides } from '@/lib/voice/buildAssistantOverrides';
import { useAuthStore } from '@/stores/authStore';
import { useSessionLogStore } from '@/stores/sessionLogStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { shouldWipeOnAnonIdChange } from './onboardingThreadWipe';

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
  const { voiceOn, micOn, toggleMic } = useDualButtonControls();

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
  // Vapi splits one model turn into multiple transcript-final events on natural
  // speech pauses. Consecutive assistant finals within this window merge into
  // ONE chat bubble so the UI doesn't render N fragments for one reply.
  const ASSISTANT_MERGE_WINDOW_MS = 4000;
  const lastAssistantAppendAtRef = useRef<number>(0);
  // assistantMergeOpen mirrors the merge window as observable state so the
  // overlay can render partials INLINE with the last AI bubble while it's open,
  // instead of as a separate streaming bubble that flickers.
  const [assistantMergeOpen, setAssistantMergeOpen] = useState(false);
  const mergeWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armMergeWindow = useCallback(() => {
    setAssistantMergeOpen(true);
    if (mergeWindowTimerRef.current !== null) clearTimeout(mergeWindowTimerRef.current);
    mergeWindowTimerRef.current = setTimeout(() => {
      mergeWindowTimerRef.current = null;
      setAssistantMergeOpen(false);
    }, ASSISTANT_MERGE_WINDOW_MS);
  }, []);
  const closeMergeWindow = useCallback(() => {
    if (mergeWindowTimerRef.current !== null) {
      clearTimeout(mergeWindowTimerRef.current);
      mergeWindowTimerRef.current = null;
    }
    setAssistantMergeOpen(false);
  }, []);

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
  const transcriptBus = useRef(
    createListenerBus<RealtimeTranscriptEvent>('onboarding-voice/transcript'),
  ).current;
  const voiceActionBus = useRef(
    createListenerBus<OnboardingVoiceResult>('onboarding-voice/voice-action'),
  ).current;
  const notifyTranscriptListeners = transcriptBus.notify;
  const subscribeTranscripts = transcriptBus.subscribe;
  const notifyVoiceActions = voiceActionBus.notify;
  const subscribeVoiceActions = voiceActionBus.subscribe;
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const getClientRef = useRef<() => Vapi | null>(() => null);
  const currentScreenIdRef = useRef<string | null>(currentScreenId);
  useEffect(() => {
    currentScreenIdRef.current = currentScreenId;
  }, [currentScreenId]);

  const pendingRef = useRef<'starting' | 'stopping' | null>(null);
  const lastTransitionRef = useRef<Promise<unknown> | null>(null);
  const vapiShouldBeLiveRef = useRef(false);

  // Provider lives for the whole app; on logout → new user the previous
  // user's onboarding transcript (stored unscrubbed by design) would leak
  // into the next session without this. First resolve (null→id) keeps the
  // hydrated thread; only a genuine user switch wipes.
  const prevAnonIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevAnonIdRef.current;
    const next = anonId ?? null;
    prevAnonIdRef.current = next;
    if (shouldWipeOnAnonIdChange(prev, next)) {
      setMessages([]);
    }
  }, [anonId]);

  // Form snapshot — updated by each onboarding page via setFormSnapshot.
  // Read by buildOverridesForCall (cold start) and pushScreenContext (screen
  // change), and used to drive a debounced "form state update" add-message
  // when the snapshot changes mid-screen.
  const formSnapshotRef = useRef<Record<string, unknown>>({});
  const formSnapshotPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const FORM_SNAPSHOT_DEBOUNCE_MS = 1200;

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
        registeredScreenIdRef.current ??
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
      try {
        c.send({
          type: 'add-message',
          message: { role: 'system', content: body },
          triggerResponseEnabled: false,
        });
      } catch (err) {
        // Vapi SDK throws synchronously when send() runs pre-join. Next
        // pushScreenContext / cold-start overrides will resend the snapshot.
        if (import.meta.env.DEV)
          console.debug('[onboarding-voice] form snapshot send skipped', err);
      }
    }, FORM_SNAPSHOT_DEBOUNCE_MS);
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
    try {
      client.send({
        type: 'add-message',
        message: { role: 'system', content: body },
        triggerResponseEnabled: false,
      });
      if (import.meta.env.DEV) {
        console.debug('[onboarding-voice] cold-start snapshot add-message sent', sid);
      }
    } catch (err) {
      // Vapi SDK throws synchronously pre-join; pushScreenContext on screen
      // change carries the same data, so a lost cold-start push isn't fatal.
      if (import.meta.env.DEV) {
        console.debug('[onboarding-voice] cold-start snapshot send skipped', err);
      }
    }
  }, []);

  const onCallStart = useCallback(() => {
    setEndedFlag(false);
    setProviderError(null);
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    clearRetryTimer();
    // Thread persists across the Vapi round-trip; turns append in handleTranscript.
    threadScreenIdRef.current = null;
    lastAssistantFinalRef.current = { text: '', at: 0 };
    const sid =
      activeSubScreenIdRef.current ?? registeredScreenIdRef.current ?? currentScreenIdRef.current;
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

  const handleTranscript = useCallback(
    (evt: RealtimeTranscriptEvent) => {
      if (evt.role === 'user') {
        if (evt.kind === 'partial') {
          if (userActiveTimerRef.current) clearTimeout(userActiveTimerRef.current);
          setIsUserSpeaking(true);
          // User starting to speak = assistant turn is semantically complete.
          // Close any open assistant merge window so the next AI final starts a
          // fresh bubble (instead of merging into the previous one).
          closeMergeWindow();
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
            if (evt.role === 'assistant') {
              const withinMergeWindow =
                now - lastAssistantAppendAtRef.current < ASSISTANT_MERGE_WINDOW_MS;
              lastAssistantAppendAtRef.current = now;
              armMergeWindow();
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (withinMergeWindow && last && last.role === 'ai') {
                  // Glue with a space — Vapi already includes punctuation per fragment.
                  const merged: VoiceMessage = {
                    ...last,
                    text: `${last.text} ${text}`.replace(/\s+/g, ' ').trim(),
                  };
                  return [...prev.slice(0, -1), merged];
                }
                return [...prev, { id: `vapi-${evt.role}-${now}`, role: 'ai', text }];
              });
            } else {
              // User transcripts always start a fresh bubble + close any open
              // assistant merge window (next AI utterance starts a fresh bubble).
              lastAssistantAppendAtRef.current = 0;
              closeMergeWindow();
              setMessages((prev) => [
                ...prev,
                { id: `vapi-${evt.role}-${now}`, role: 'user', text },
              ]);
            }
          }
        }
      }
      // Partials flow through unconditionally — the overlay decides where to
      // render them (inline with the last AI bubble during merge window, or as
      // a separate streaming bubble otherwise). The previous "suppress during
      // merge" approach traded flicker for a stuck-feeling silent window;
      // inline rendering avoids both.
      notifyTranscriptListeners(evt);
    },
    [notifyTranscriptListeners, armMergeWindow, closeMergeWindow],
  );

  // Per-call override builder — fires inside useRealtimeVoice.start() right
  // before vapi.start(). Injects the current screen's context_block + recent
  // state_delta as a system message and flips firstMessageMode so the model
  // generates the opening from that context (instead of the static dashboard
  // firstMessage greeting). Pre-seeds lastPushedScreenIdRef so onCallStart
  // skips the now-redundant add-message push.
  const buildOverridesForCall = useCallback(async (): Promise<
    Partial<AssistantOverrides> | undefined
  > => {
    const sid =
      activeSubScreenIdRef.current ?? registeredScreenIdRef.current ?? currentScreenIdRef.current;
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
      mode: 'replace' | 'append-if-empty' | 'append' | 'append-if-absent' = 'replace',
    ) => {
      // append-if-absent re-seeds the same screen on overlay reopen; let it
      // through and rely on id-dedup instead of the per-screen early-return.
      if (mode !== 'append-if-absent' && threadScreenIdRef.current === screenId) return;
      threadScreenIdRef.current = screenId;
      setMessages((prev) => applyStartThread(prev, initial, mode));
    },
    [],
  );

  // Page registers its authoritative screen_id so the lifted LLM keys context
  // off the same id the page uses — not the (sometimes coarser) route id.
  // The Direct-LLM chat path already preferred this id over the route lookup
  // (see chatScreenId); the Vapi cold-start + push paths now do the same, so
  // a stale route→screen entry in the bundle can't silently push the wrong
  // context to Vapi. Mirror the state into a ref so the ref-based call sites
  // (onCallStart, buildOverridesForCall, form-snapshot push) can read it.
  const [registeredScreenId, setRegisteredScreenId] = useState<string | null>(null);
  const registeredScreenIdRef = useRef<string | null>(null);
  useEffect(() => {
    registeredScreenIdRef.current = registeredScreenId;
  }, [registeredScreenId]);
  const registerScreen = useCallback((screenId: string | null) => {
    setRegisteredScreenId((prev) => (prev === screenId ? prev : screenId));
  }, []);

  // Page registers its advance handler (revisit-affirm shortcut fires it).
  const onAdvanceRef = useRef<(() => void) | null>(null);
  const registerAdvance = useCallback((cb: (() => void) | null) => {
    onAdvanceRef.current = cb;
  }, []);
  const fireAdvance = useCallback(() => onAdvanceRef.current?.(), []);

  const orbState = orbStateFrom(voiceOn, micOn);
  const voiceInShouldBeLive =
    VOICE_IN_ENABLED && inOnboarding && micOn && !voiceOn && !!currentScreenId;

  const emitAssistant = useCallback(
    (text: string, kind: 'partial' | 'final') => {
      notifyTranscriptListeners({ role: 'assistant', kind, text });
    },
    [notifyTranscriptListeners],
  );

  const chatScreenId = activeSubScreenId ?? registeredScreenId ?? currentScreenId;
  // Exclude Vapi (state 1) — it owns its own turns; minting a Direct-LLM session
  // there would orphan one per screen.
  const chatEnabled =
    inOnboarding &&
    orbState !== 'vapi' &&
    !!chatScreenId &&
    chatScreenId.startsWith('ONBOARD-') &&
    (overlayOpen || voiceInShouldBeLive);

  const { sendUserTurn, chatBusy } = useOnboardingChat({
    screenId: chatScreenId,
    enabled: chatEnabled,
    orbState,
    coachingStyle,
    appendMessage,
    startThread,
    emitAssistant,
    onVoiceAction: notifyVoiceActions,
    onAdvance: fireAdvance,
  });

  const emitVoiceInInterim = useCallback(
    (text: string) => {
      notifyTranscriptListeners({ role: 'user', kind: 'partial', text });
    },
    [notifyTranscriptListeners],
  );

  // Final voice turn → clear the live partial, then route to the LLM (the user
  // bubble is added by the LLM message mirror, same as typed input).
  const emitVoiceInFinal = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      notifyTranscriptListeners({ role: 'user', kind: 'final', text: trimmed });
      sendUserTurn(trimmed);
    },
    [notifyTranscriptListeners, sendUserTurn],
  );

  const handleVoiceInError = useCallback(
    (msg: string) => {
      setProviderError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `voice-err-${Date.now()}`,
          role: 'ai',
          text: 'I lost the voice connection — you can keep typing.',
        },
      ]);
      // disarm mic → State 4; user re-taps to retry
      if (micOn) toggleMic();
    },
    [micOn, toggleMic],
  );

  const { isListening: voiceInListening } = useVoiceInCapture({
    active: voiceInShouldBeLive,
    vapiStatus: status,
    onTranscript: emitVoiceInFinal,
    onInterim: emitVoiceInInterim,
    responding: false,
    onError: handleVoiceInError,
  });

  useEffect(() => {
    if (!voiceInShouldBeLive) return;
    startKeyWarmLoop();
    return () => stopKeyWarmLoop();
  }, [voiceInShouldBeLive]);

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
      // Also skip when pendingRef==='stopping' — endCall() flips that flag
      // BEFORE updatePreferences propagates, so vapiShouldBeLive can still
      // briefly evaluate to true while we're tearing down. Without this
      // guard a phantom start() would queue, fire after our direct stop(),
      // and the next render would queue a second stop. Net: pointless
      // start/stop churn on the way out.
      if (
        status === 'active' ||
        status === 'connecting' ||
        pendingRef.current === 'starting' ||
        pendingRef.current === 'stopping'
      ) {
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
      // Belt to endCall's suspenders: any path that leaves the onboarding
      // route — finalize tap, browser back, hard navigation — must also kill
      // any in-flight Vapi call. The vapiShouldBeLive derivation will reach
      // the same conclusion but on a slower timeline. stop() is sync void
      // and self-guards (no-ops if already torn down), so no try/catch.
      stop();
    }
  }, [inOnboarding, clearRetryTimer, clearRemoteEndCooldownTimer, stop]);

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
    const screenToFetch = activeSubScreenId ?? registeredScreenId ?? currentScreenId;
    if (!screenToFetch) return;
    if (lastPushedScreenIdRef.current === screenToFetch) return;
    const priorTs = lastScreenChangeTsRef.current;
    lastScreenChangeTsRef.current = new Date().toISOString();
    void pushScreenContext(screenToFetch, priorTs);
  }, [status, currentScreenId, activeSubScreenId, registeredScreenId, pushScreenContext]);

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
    // Hard-stop the Vapi WebRTC immediately. Previously endCall only wrote
    // preferences and let the vapiShouldBeLive effect discover the change —
    // which left a ~1-2s window where the agent kept speaking after the user
    // tapped "Start plan" and the app navigated to /home.
    //
    // pendingRef='stopping' protects against a phantom start firing in the
    // window between stop() and the preferences flip (the start-branch's
    // early-return clause checks for it). It MUST be cleared right after
    // stop() returns — otherwise it leaks past the call and the start-guard
    // refuses every future start() for the lifetime of the provider, which
    // wraps the whole app and never unmounts. The lastTransitionRef path's
    // .finally() clears it on that codepath, but we bypass that chain here
    // for synchronous teardown, so clear inline.
    pendingRef.current = 'stopping';
    stop();
    pendingRef.current = null;
    void updatePreferences({ voiceMode: 'screen', micEnabled: false });
  }, [updatePreferences, stop]);

  const restartCall = useCallback(async () => {
    clearRetryTimer();
    clearRemoteEndCooldownTimer();
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    setRemoteEndCooldown(false);
    setProviderError(null);
    await updatePreferences({ voiceMode: 'voice', micEnabled: true });
  }, [clearRetryTimer, clearRemoteEndCooldownTimer, updatePreferences]);

  const value = useMemo<OnboardingVoiceContextValue>(
    () => ({
      status,
      isAssistantSpeaking: isSpeaking,
      isUserSpeaking,
      voiceInListening,
      errorMessage,
      currentScreenId: activeSubScreenId ?? currentScreenId,
      overlayOpen,
      openOverlay,
      closeOverlay,
      messages,
      appendMessage,
      startThread,
      sendUserTurn,
      chatBusy,
      assistantMergeOpen,
      subscribeVoiceActions,
      registerScreen,
      registerAdvance,
      endCall,
      restartCall,
      pushSubScreen,
      setFormSnapshot,
      subscribeTranscripts,
      voiceCapReached: voiceCapReached && !capDismissed && inOnboarding,
      dismissVoiceCap,
    }),
    [
      status,
      isSpeaking,
      isUserSpeaking,
      voiceInListening,
      errorMessage,
      activeSubScreenId,
      currentScreenId,
      overlayOpen,
      openOverlay,
      closeOverlay,
      messages,
      appendMessage,
      startThread,
      sendUserTurn,
      chatBusy,
      subscribeVoiceActions,
      registerScreen,
      registerAdvance,
      endCall,
      restartCall,
      pushSubScreen,
      setFormSnapshot,
      subscribeTranscripts,
      assistantMergeOpen,
      voiceCapReached,
      capDismissed,
      inOnboarding,
      dismissVoiceCap,
    ],
  );

  return (
    <OnboardingVoiceContext.Provider value={value}>
      {children}
      {inOnboarding && overlayOpen && <OnboardingChatOverlay onClose={closeOverlay} />}
      <VoiceCapModal />
    </OnboardingVoiceContext.Provider>
  );
}
