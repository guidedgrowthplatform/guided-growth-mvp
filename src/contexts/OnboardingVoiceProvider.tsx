import { useQueryClient } from '@tanstack/react-query';
import type Vapi from '@vapi-ai/web';
import type { AssistantOverrides } from '@vapi-ai/web/dist/api';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { appendChatTurn, fetchOnboardingThread } from '@/api/chat';
import { OnboardingChatOverlay } from '@/components/onboarding/OnboardingChatOverlay';
import { getOnboardingOpenerForState } from '@/components/onboarding/onboardingOpeners';
import { VoiceCapModal } from '@/components/voice/VoiceCapModal';
import {
  FULL_DUPLEX_BARGE_IN,
  TURN_AGGREGATION_MS,
  TURN_PAUSE_COMPLETE_MS,
  TURN_PAUSE_INCOMPLETE_MS,
} from '@/config/voiceConfig';
import { applyStartThread } from '@/contexts/applyStartThread';
import {
  idleSilenceRemainingMs,
  isUserSilenceElapsed,
  shouldArmIdleTimer,
} from '@/contexts/idleTimerGate';
import {
  OnboardingVoiceContext,
  USER_SPEAKING_IDLE_MS,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceResult,
  type OnboardingVoiceStatus,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import { vapiLiveGate } from '@/contexts/vapiLiveGate';
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
  ONBOARDING_CHAT_VAPI,
  ONBOARDING_INSTANT_OPENER,
  ONBOARDING_VAPI_IDLE_TIMEOUT_MS,
} from '@/lib/config/voice';
import { buildContextMessage } from '@/lib/context/buildContextMessage';
import { getScreenContext } from '@/lib/context/getScreenContext';
import { buildOpenerDirective } from '@/lib/context/onboardingBeatBundle';
import { getBundledRoutes } from '@/lib/context/screenContextsBundle';
import { screenIdForRoute } from '@/lib/context/screenIdForRoute';
import {
  adoptOnboardingChatSessionId,
  getOrCreateOnboardingChatSessionId,
} from '@/lib/onboarding/onboardingChatSession';
import {
  ONBOARDING_CHAT_ROUTE,
  ONBOARDING_FLOW_PREVIEW_ROUTE,
  ONBOARDING_FLOW_ROUTE,
} from '@/lib/onboarding/onboardingStepBeats';
import { isVapiCapableBeat, isIdleCaptureBeat } from '@/onboarding-flow/beatEngineMeta';
import { engineForTurn } from '@/lib/orb/engineForTurn';
import { orbStateFrom, type OrbState } from '@/lib/orb/orbState';
import { queryKeys } from '@/lib/query';
import { startKeyWarmLoop, stopKeyWarmLoop } from '@/lib/services/soniox-temp-key-cache';
import { useTtsPlaybackStore } from '@/lib/services/tts-service';
import { createListenerBus } from '@/lib/util/listenerBus';
import { buildAssistantOverrides } from '@/lib/voice/buildAssistantOverrides';
import { speakOpener, type SpeakOpenerHandle } from '@/lib/voice/speakOpener';
import { resolveTurnPauseMs } from '@/lib/voice/turnDecision';
import { ONBOARDING_BEAT_MP3S } from '@/onboarding-flow/renderer/useBeatOpenerMp3';
import { applyName } from '@/onboarding-flow/renderer/applyName';
import { useAuthStore } from '@/stores/authStore';
import { useSessionLogStore } from '@/stores/sessionLogStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import type { OnboardingState } from '@gg/shared/types';
import type { OnboardingThreadTurn } from '@gg/shared/types/llm';
import { clearThread, loadThread, saveThread } from './onboardingThreadStore';
import { shouldWipeOnAnonIdChange } from './onboardingThreadWipe';

// Server thread turn → live VoiceMessage. client_turn_key (the stable vapi-/opener-
// id) becomes the VoiceMessage id so hydrated turns align with localStorage + the
// mirror dedup; Direct-LLM turns keep their UUID id (skipped by the mirror).
function threadTurnToVoiceMessage(t: OnboardingThreadTurn): VoiceMessage {
  const source: VoiceMessage['source'] = t.client_turn_key
    ? t.client_turn_key.startsWith('opener-')
      ? 'opener'
      : 'vapi'
    : 'direct_llm';
  return {
    id: t.client_turn_key ?? t.id,
    role: t.role === 'assistant' ? 'ai' : 'user',
    text: t.content ?? '',
    screenId: t.screen_id,
    source,
  };
}

// Force every beat's opener (its first coach turn before any user turn) to the
// stable `opener-${sid}` id, so a re-spoken opener REPLACES the hydrated one
// instead of stacking a duplicate — even for turns persisted before stable ids.
function normalizeOpenerIds(msgs: VoiceMessage[]): VoiceMessage[] {
  const sawUser = new Set<string>();
  const openerDone = new Set<string>();
  return msgs.map((m) => {
    const sid = m.screenId;
    if (!sid) return m;
    if (m.role === 'user') {
      sawUser.add(sid);
      return m;
    }
    if (m.role === 'ai' && !sawUser.has(sid) && !openerDone.has(sid)) {
      openerDone.add(sid);
      return { ...m, id: `opener-${sid}`, source: 'opener' };
    }
    return m;
  });
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

const MAX_AUTO_RETRIES = 2;
// Breath window before the mic goes hot (first arm + post-TTS) — covers the echo
// tail + a Siri-style pause. Mirrors useCoachChat's MIC_GRACE_MS.
const MIC_GRACE_MS = 2500;
const RETRY_BACKOFFS_MS = [2000, 5000];
const IDLE_TIMEOUT_MS = ONBOARDING_VAPI_IDLE_TIMEOUT_MS;
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

  // The auth-free preview route (/onboarding-flow-preview) is a real chat
  // onboarding surface (see onChatPage), it just lives outside the /onboarding/*
  // namespace. Count it as in-onboarding so the "!inOnboarding -> stop()" guard
  // below does not tear its own voice down, letting the no-login walk run the
  // full Cartesia opener + Vapi path.
  const inOnboarding =
    isOnboardingPath(location.pathname) || location.pathname === ONBOARDING_FLOW_PREVIEW_ROUTE;
  // Chat-native onboarding renders at the onboarding root (the chat IS the
  // surface). The page renders the chat body itself, so the provider must NOT
  // also pop the floating overlay. Vapi (Path 1) is dormant here UNLESS the
  // ONBOARDING_CHAT_VAPI flag is on, in which case both-orbs-on arms real Vapi
  // full-duplex on the covered beats (profile → fork; see CHAT_VAPI_BEAT_SCREENS);
  // otherwise the loop is Soniox→LLM (mic only) with no standalone Cartesia.
  const onChatPage =
    location.pathname === ONBOARDING_CHAT_ROUTE ||
    location.pathname === ONBOARDING_FLOW_ROUTE ||
    location.pathname === ONBOARDING_FLOW_PREVIEW_ROUTE;
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
  // Live word-reveal for the cold-start Cartesia opener, paced by the real audio
  // (speakOpener's playback fraction) so the karaoke syncs to the voice instead of
  // a fixed-cadence guess. Scoped by screenId; consumed by BeatConversation.
  const [openerReveal, setOpenerReveal] = useState<{
    screenId: string;
    revealedWords: number;
  } | null>(null);
  const openerRevealCountRef = useRef(-1);
  // Beats whose opener has been spoken THIS session — so a re-spoken opener's
  // first final replaces a stale/hydrated opener bubble, and later finals of the
  // same utterance accumulate into it (one stable opener bubble per beat).
  const openerSpeakStartedRef = useRef<Set<string>>(new Set());
  const threadScreenIdRef = useRef<string | null>(null);
  const lastAssistantFinalRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const lastUserFinalRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  // Vapi splits one model turn into multiple transcript-final events on natural
  // speech pauses — sometimes seconds apart for a long reply. All finals in one
  // assistant turn merge into ONE bubble; the turn stays "open" until the user
  // speaks / the screen changes / the call restarts (NOT a wall-clock timer,
  // which would split a slow reply mid-turn).
  const assistantTurnOpenRef = useRef<boolean>(false);
  // Role of the last committed transcript turn. One bubble per speaker-turn:
  // consecutive finals of the same role (within the same beat) merge; a role
  // change or beat change starts a fresh bubble. Keyed off FINALS (not partials)
  // so echo/noise partials can't fragment a turn.
  const lastTurnRoleRef = useRef<'ai' | 'user' | null>(null);
  // assistantMergeOpen mirrors a short visual window so the active bubble keeps
  // its streaming cursor; it's cosmetic and independent of the merge decision.
  const ASSISTANT_MERGE_WINDOW_MS = 4000;
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
  // Wall-clock of the last REAL user activity (user STT partial/final, or call
  // start / opener completion). The idle auto-pause measures silence from THIS,
  // never from when the listening window (re)opened — so the assistant's own
  // silence re-prompt (Vapi nudging a quiet user, which bounces state
  // speaking→listening) can't reset the clock and keep the call alive forever.
  // Genuine continuous user silence accumulates to IDLE_TIMEOUT_MS even across
  // assistant re-prompts, and only then do we systemPauseMic().
  const lastUserActivityAtRef = useRef<number>(0);
  const remoteEndCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once the coach has spoken on the current call — gates the idle
  // auto-pause timer (don't pause a call before the coach has even greeted).
  // Reactive STATE, not just a ref, so the arm effect re-runs the moment it
  // flips. Two sources flip it: Vapi's own TTS (speech-start) on warm beats,
  // AND the instant Cartesia opener finishing on the cold-start beat, where
  // Vapi joins silent and its speech-start never fires. Without the opener
  // source the first chat-native Vapi beat never armed the timer, so an idle
  // user left the live call burning voice minutes.
  const [assistantHasSpoken, setAssistantHasSpoken] = useState(false);
  // Ref mirror for the imperative opener-done callback (fires outside render).
  const assistantHasSpokenRef = useRef(false);
  const markAssistantSpoke = useCallback(() => {
    if (assistantHasSpokenRef.current) return;
    assistantHasSpokenRef.current = true;
    setAssistantHasSpoken(true);
  }, []);
  const clearAssistantSpoke = useCallback(() => {
    if (!assistantHasSpokenRef.current) return;
    assistantHasSpokenRef.current = false;
    setAssistantHasSpoken(false);
  }, []);
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
  // client_turn_key → last mirrored text. Skips a re-POST when a live turn's text
  // hasn't grown; cleared on a genuine user switch so a new user can't no-op.
  const mirroredTurnsRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const prev = prevAnonIdRef.current;
    const next = anonId ?? null;
    prevAnonIdRef.current = next;
    if (shouldWipeOnAnonIdChange(prev, next)) {
      setMessages([]);
      mirroredTurnsRef.current.clear();
      if (prev) clearThread(prev);
      return;
    }
    // First resolve (null→id) or same id: hydrate the persisted thread so the
    // conversation survives a refresh. Only seed when in-memory is still empty,
    // so a live session is never clobbered.
    if (next) {
      const stored = normalizeOpenerIds(loadThread(next));
      if (stored.length) setMessages((cur) => (cur.length ? cur : stored));
    }
  }, [anonId]);

  // Persist the thread on every change so a refresh restores the conversation.
  useEffect(() => {
    if (!anonId) return;
    saveThread(anonId, messages);
  }, [anonId, messages]);

  // Mirror the latest live voice/opener turn to Supabase (lifetime persistence).
  // Fires on the LAST message because the merge mutates it in place under a stable
  // `vapi-`/`opener-` id — so a turn whose text grows re-POSTs the same
  // client_turn_key and the server UPDATEs the row. Hydrated rows carry UUID ids
  // and are skipped; Direct-LLM/error turns are skipped by source/id. Idempotent,
  // so the StrictMode double-run and refresh re-fires never duplicate.
  useEffect(() => {
    if (!anonId) return;
    const last = messages[messages.length - 1];
    if (!last || !last.text) return;
    const sid = last.screenId;
    if (!sid || !sid.startsWith('ONBOARD-')) return;
    const isLiveTurn = last.id.startsWith('vapi-') || last.id.startsWith('opener-');
    if (!isLiveTurn) return;
    if (mirroredTurnsRef.current.get(last.id) === last.text) return;
    mirroredTurnsRef.current.set(last.id, last.text);
    const mode = last.source === 'opener' || last.id.startsWith('opener-') ? 'opener' : 'chat';
    void appendChatTurn({
      chat_session_id: getOrCreateOnboardingChatSessionId(),
      screen_id: sid,
      role: last.role,
      text: last.text,
      client_turn_key: last.id,
      mode,
    }).catch(() => {
      // best-effort; localStorage thread + next turn's re-fire cover a transient miss
    });
  }, [anonId, messages]);

  // Cross-device / lifetime hydration: resolve the canonical onboarding thread by
  // anon_id and seed the feed. Runs once per anon while on the onboarding surface
  // (returning user resuming on a new device); the server is the source of truth,
  // localStorage is only the instant cache. Adopts the resolved session id so live
  // turns continue the SAME thread instead of minting a fresh one.
  const hydratedThreadAnonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!anonId || !inOnboarding) return;
    if (hydratedThreadAnonRef.current === anonId) return;
    hydratedThreadAnonRef.current = anonId;
    let cancelled = false;
    void fetchOnboardingThread()
      .then((res) => {
        if (cancelled || !res.chat_session_id || res.messages.length === 0) return;
        adoptOnboardingChatSessionId(res.chat_session_id);
        const seeded = normalizeOpenerIds(
          res.messages
            .filter((t) => (t.content ?? '').trim().length > 0)
            .map(threadTurnToVoiceMessage),
        );
        if (seeded.length === 0) return;
        // Don't clobber a longer live/in-progress in-memory thread.
        setMessages((cur) => (cur.length >= seeded.length ? cur : seeded));
        // Pre-seed the mirror dedup so hydrated turns don't re-POST.
        seeded.forEach((m) => mirroredTurnsRef.current.set(m.id, m.text));
      })
      .catch(() => {
        // offline / not signed in — localStorage hydration still applies
      });
    return () => {
      cancelled = true;
    };
  }, [anonId, inOnboarding]);

  // Form snapshot — updated by each onboarding page via setFormSnapshot.
  // Read by buildOverridesForCall (cold start) and pushScreenContext (screen
  // change), and used to drive a debounced "form state update" add-message
  // when the snapshot changes mid-screen.
  const formSnapshotRef = useRef<Record<string, unknown>>({});
  const formSnapshotPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const FORM_SNAPSHOT_DEBOUNCE_MS = 1200;

  // A screen-context add-message that couldn't be delivered because the Vapi
  // call hadn't joined yet (client.send → Daily sendAppMessage throws
  // "sendAppMessage() only supported after join." pre-join). We stash the
  // rendered body here and flush it from onCallStart (which fires on join), so
  // the context still reaches Vapi instead of throwing and being lost.
  const pendingScreenContextRef = useRef<{ screenId: string; body: string } | null>(null);
  const deferredScreenContextRef = useRef<Set<string>>(new Set());
  const [deferredScreenContextVersion, setDeferredScreenContextVersion] = useState(0);
  const setScreenContextDeferred = useCallback((screenId: string, deferred: boolean) => {
    const deferredSet = deferredScreenContextRef.current;
    const hasScreen = deferredSet.has(screenId);
    if (deferred === hasScreen) return;
    if (deferred) {
      deferredSet.add(screenId);
    } else {
      deferredSet.delete(screenId);
    }
    setDeferredScreenContextVersion((version) => version + 1);
  }, []);

  // The beat whose opener the Cartesia instant-opener spoke (cold-start). The
  // warm-beat opener directive is skipped for it so Vapi never re-says it.
  const instantOpenedScreenRef = useRef<string | null>(null);

  const pushScreenContext = useCallback(
    async (screenId: string, sinceTs: string | null) => {
      const client = getClientRef.current();
      if (!client) return;
      if (deferredScreenContextRef.current.has(screenId)) return;
      try {
        const ctx = await getScreenContext(qc, screenId, sinceTs);
        // Merge persisted data UNDER the in-flight snapshot: the ref can lag the
        // realtime cache (e.g. nickname not yet propagated at FORK mount), so
        // already-persisted fields must never be dropped. In-flight overrides win.
        const persisted =
          qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state)?.data ?? {};
        const filled = { ...persisted, ...formSnapshotRef.current };
        // Warm-beat opener: Vapi opens the beat with the authored line verbatim
        // (rigid). Skipped for the cold-start beat (Cartesia spoke that opener)
        // and MP3 beats (the prerecorded clip already spoke the opener).
        const openerDirective =
          screenId === instantOpenedScreenRef.current || screenId in ONBOARDING_BEAT_MP3S
            ? null
            : buildOpenerDirective(screenId);
        const contextBlock = openerDirective
          ? `${openerDirective}\n\n${ctx.context_block}`
          : ctx.context_block;
        const body = buildContextMessage({
          screen_id: ctx.screen_id,
          context_block: contextBlock,
          state_delta: ctx.state_delta,
          filled_form_state: filled,
        });
        if (deferredScreenContextRef.current.has(screenId)) return;
        lastPushedScreenIdRef.current = screenId;
        try {
          client.send({
            type: 'add-message',
            message: { role: 'system', content: body },
            triggerResponseEnabled: true,
          });
        } catch (sendErr) {
          // Vapi/Daily throws synchronously if send() runs before the call has
          // joined ("sendAppMessage() only supported after join."). Don't surface
          // it as a provider error. Queue the body and flush it on call-start.
          pendingScreenContextRef.current = { screenId, body };
          if (import.meta.env.DEV) {
            console.debug('[onboarding-voice] screen-context queued (pre-join)', sendErr);
          }
          return;
        }
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

  // ─── Instant personalized opener (ONBOARDING_INSTANT_OPENER) ──────────────
  // Hides the Vapi cold-start latency on the FIRST Vapi-covered beat: Cartesia
  // speaks the opener instantly while Vapi connects silent (assistant-waits-for-
  // user), and the Vapi mic is held muted until BOTH the opener audio ended AND
  // Vapi is connected. All refs are inert unless the flag is on, so the standard
  // path is byte-for-byte unchanged.
  //
  // openerUsedRef: the cold-start beat fires the instant opener once per session
  // (later beats are warm, no latency to hide). instantOpenerActiveRef: this
  // specific call took the silent-first path, so its mic must be gated.
  const openerUsedRef = useRef(false);
  const instantOpenerActiveRef = useRef(false);
  const openerHandleRef = useRef<SpeakOpenerHandle | null>(null);
  const openerDoneRef = useRef(false);
  const vapiJoinedRef = useRef(false);
  // Last resort against a dead mic: if the unmute gate never resolves (Vapi
  // 'call-start' late/missing, or setMuted throws), force the mic open after
  // this window so the user is never stuck mic-muted on a live call.
  const openerFailsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const OPENER_FAILSAFE_MS = 10000;

  const clearOpenerFailsafe = useCallback(() => {
    if (openerFailsafeTimerRef.current !== null) {
      clearTimeout(openerFailsafeTimerRef.current);
      openerFailsafeTimerRef.current = null;
    }
  }, []);

  const stopOpener = useCallback(() => {
    if (openerHandleRef.current) {
      openerHandleRef.current.stop();
      openerHandleRef.current = null;
    }
  }, []);

  // Unmute the Vapi mic once BOTH gates pass (opener audio ended AND Vapi
  // joined). Order-independent: whichever finishes last triggers the unmute.
  const maybeOpenMic = useCallback(() => {
    if (!instantOpenerActiveRef.current) return;
    if (!openerDoneRef.current || !vapiJoinedRef.current) return;
    const client = getClientRef.current();
    if (!client) return;
    try {
      client.setMuted(false);
    } catch (err) {
      // Unmute FAILED — leave the gate armed so a later trigger (or the
      // failsafe timer) retries. Clearing it here would consume the one-shot
      // with the mic still muted.
      if (import.meta.env.DEV) console.debug('[onboarding-voice] opener unmute skipped', err);
      return;
    }
    // One-shot: the gate is satisfied, the call now runs as a normal warm call.
    instantOpenerActiveRef.current = false;
    clearOpenerFailsafe();
  }, [clearOpenerFailsafe]);

  const onCallStart = useCallback(() => {
    setEndedFlag(false);
    setProviderError(null);
    retryCountRef.current = 0;
    fatalErrorRef.current = false;
    clearRetryTimer();
    // Seed the idle window so a user who never speaks still auto-pauses
    // IDLE_TIMEOUT_MS after the assistant's opening settles into listening.
    lastUserActivityAtRef.current = Date.now();
    // Thread persists across the Vapi round-trip; turns append in handleTranscript.
    threadScreenIdRef.current = null;
    lastAssistantFinalRef.current = { text: '', at: 0 };
    assistantTurnOpenRef.current = false;
    lastTurnRoleRef.current = null;

    vapiJoinedRef.current = true;
    const sid =
      activeSubScreenIdRef.current ?? registeredScreenIdRef.current ?? currentScreenIdRef.current;

    // Flush any screen-context that was queued because a send() ran pre-join
    // (the sendAppMessage-before-join guard). Only flush it if it still matches
    // the resolved screen: if the screen changed during the connecting window,
    // the queued body is stale — dropping it lets the resolved-sid push below
    // fire the single, correct greeting instead of BOTH (which stuttered turn 0).
    const pending = pendingScreenContextRef.current;
    pendingScreenContextRef.current = null;
    if (pending && pending.screenId === sid) {
      const client = getClientRef.current();
      if (client) {
        try {
          client.send({
            type: 'add-message',
            message: { role: 'system', content: pending.body },
            triggerResponseEnabled: true,
          });
        } catch (err) {
          if (import.meta.env.DEV) {
            console.debug('[onboarding-voice] queued screen-context flush failed', err);
          }
        }
      }
    } else if (pending) {
      // Stale (screen changed) — reset the dedupe marker so the push below runs.
      lastPushedScreenIdRef.current = null;
    }

    // Instant-opener call: mute the Vapi mic on join so the user can't talk into
    // Vapi (and Vapi STT can't hear the Cartesia opener) until both gates pass.
    if (instantOpenerActiveRef.current) {
      const client = getClientRef.current();
      if (client) {
        try {
          client.setMuted(true);
        } catch (err) {
          if (import.meta.env.DEV) console.debug('[onboarding-voice] opener mute skipped', err);
        }
      }
      // If the opener already finished while Vapi was connecting, open now.
      maybeOpenMic();
    } else {
      // Every call joins with startAudioOff:true (set once on the shared Vapi
      // instance). Only the instant-opener beat has an unmute path; without this,
      // every other call — the fork, later beats, and post-error retries — stays
      // muted, so Vapi receives pure silence and ends with
      // did-not-receive-customer-audio. Open the mic on join.
      const client = getClientRef.current();
      if (client) {
        try {
          client.setMuted(false);
        } catch (err) {
          if (import.meta.env.DEV) console.debug('[onboarding-voice] join unmute skipped', err);
        }
      }
    }

    // If we already injected the screen context via assistantOverrides at
    // vapi.start() (the cold-start path), skip the redundant context push —
    // Vapi would fire a second turn-0 response and stutter the opening.
    // But ALSO send a snapshot-only add-message with triggerResponseEnabled
    // false so the FORM STATE block lands as a system message regardless of
    // whether the dashboard prompt contains the {{initial_screen_context}}
    // placeholder (variable substitution silently drops when placeholder is
    // missing — the snapshot would otherwise never reach Vapi on cold start).
    if (sid && lastPushedScreenIdRef.current !== sid && !deferredScreenContextRef.current.has(sid)) {
      lastScreenChangeTsRef.current = new Date().toISOString();
      void pushScreenContext(sid, null);
    } else if (sid) {
      pushFormSnapshotMessage(sid);
    }
  }, [pushScreenContext, clearRetryTimer, pushFormSnapshotMessage, maybeOpenMic]);

  const onEnd = useCallback(() => {
    const userInitiated = didCallStopRef.current;
    setEndedFlag(userInitiated);
    didCallStopRef.current = false;
    lastPushedScreenIdRef.current = null;
    lastScreenChangeTsRef.current = null;
    // Reset per-call instant-opener gates so a fresh call re-evaluates cleanly.
    // The opener audio (if still playing) is stopped; openerUsedRef intentionally
    // persists across the call so the cold-start opener only ever fires once.
    vapiJoinedRef.current = false;
    instantOpenerActiveRef.current = false;
    clearOpenerFailsafe();
    pendingScreenContextRef.current = null;
    stopOpener();
    if (!userInitiated) {
      setRemoteEndCooldown(true);
      clearRemoteEndCooldownTimer();
      remoteEndCooldownTimerRef.current = setTimeout(() => {
        remoteEndCooldownTimerRef.current = null;
        setRemoteEndCooldown(false);
      }, REMOTE_END_COOLDOWN_MS);
    }
  }, [clearRemoteEndCooldownTimer, stopOpener, clearOpenerFailsafe]);

  const onError = useCallback(
    (msg: string) => {
      setProviderError(msg);
      // A pre-'call-start' failure never fires onEnd, so the instant-opener
      // gates would survive into the retry half-armed (mic muted, openerUsedRef
      // already true → retry skips the opener and never re-mutes/unmutes). Reset
      // them here so the retry is a clean standard call with a live mic.
      if (instantOpenerActiveRef.current) {
        instantOpenerActiveRef.current = false;
        clearOpenerFailsafe();
        stopOpener();
      }
      if (isFatalVapiError(msg) || retryCountRef.current >= MAX_AUTO_RETRIES) {
        fatalErrorRef.current = true;
        clearRetryTimer();
        return;
      }
      const delay = RETRY_BACKOFFS_MS[retryCountRef.current] ?? 5000;
      retryCountRef.current += 1;
      clearRetryTimer();
      // Route the retry through the same pendingRef/lastTransitionRef
      // serialization the vapiShouldBeLive effect uses, so it can't race a
      // queued stop() or desync pendingRef. start()'s own stateRef guard still
      // prevents a duplicate Daily instance.
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (!vapiShouldBeLiveRef.current) return;
        if (pendingRef.current !== null) return;
        pendingRef.current = 'starting';
        const prev = lastTransitionRef.current;
        lastTransitionRef.current = Promise.resolve(prev)
          .then(() => startRef.current?.())
          .finally(() => {
            if (pendingRef.current === 'starting') pendingRef.current = null;
          });
      }, delay);
    },
    [clearRetryTimer, clearOpenerFailsafe, stopOpener],
  );

  const metadata = useMemo(
    () => ({
      anon_id: anonId ?? '',
      screen: PROVIDER_SCREEN_TAG,
      coaching_style: coachingStyle,
    }),
    [anonId, coachingStyle],
  );

  // Only USER STT activity pushes the silence deadline forward. An assistant
  // speaking or re-prompting must NOT touch this, so a Vapi idle re-prompt at
  // ~7.5s can't pre-empt the pause — continuous user silence still reaches the
  // threshold. armIdleTimer reads this ref directly, so no indirection needed.
  const handleUserActivity = useCallback(() => {
    lastUserActivityAtRef.current = Date.now();
  }, []);

  const handleTranscript = useCallback(
    (evt: RealtimeTranscriptEvent) => {
      if (evt.role === 'user') {
        if (evt.kind === 'partial') {
          if (userActiveTimerRef.current) clearTimeout(userActiveTimerRef.current);
          setIsUserSpeaking(true);
          // User starting to speak = assistant turn is semantically complete.
          // End the turn so the next AI final starts a fresh bubble.
          assistantTurnOpenRef.current = false;
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
          } else {
            if (
              lastUserFinalRef.current.text === text &&
              now - lastUserFinalRef.current.at < 1500
            ) {
              skip = true;
            } else {
              lastUserFinalRef.current = { text, at: now };
            }
          }
          if (!skip) {
            // Tag the turn with the active beat (registered screen id on the chat
            // page) so the chat-native feed groups dialogue under its beat instead
            // of dumping it as an orphan under whatever beat is active. Mirrors the
            // Direct-LLM message tagging.
            const sid =
              activeSubScreenIdRef.current ??
              registeredScreenIdRef.current ??
              currentScreenIdRef.current ??
              undefined;
            const role: 'ai' | 'user' = evt.role === 'assistant' ? 'ai' : 'user';
            // One bubble per speaker-turn: merge consecutive same-role finals (same
            // beat) into one bubble; a role change or beat change starts fresh.
            const merge = lastTurnRoleRef.current === role;
            lastTurnRoleRef.current = role;
            if (role === 'ai') {
              assistantTurnOpenRef.current = true;
              armMergeWindow();
            } else {
              assistantTurnOpenRef.current = false;
              closeMergeWindow();
            }
            // The opener is the first coach turn on a beat BEFORE any user turn.
            // Give it a STABLE per-beat id so re-entering / refreshing the beat (the
            // coach re-speaks every entry) REPLACES the opener bubble instead of
            // stacking a duplicate. The first live final this session replaces a
            // stale/hydrated opener; later finals of the same utterance accumulate.
            const beatHasUser =
              !!sid && messagesRef.current.some((m) => m.screenId === sid && m.role === 'user');
            const isOpenerTurn = role === 'ai' && !!sid && !beatHasUser;
            if (isOpenerTurn) {
              const openerId = `opener-${sid}`;
              const accumulate = openerSpeakStartedRef.current.has(sid as string);
              openerSpeakStartedRef.current.add(sid as string);
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === openerId);
                if (idx >= 0) {
                  const existing = prev[idx];
                  const newText = accumulate
                    ? `${existing.text} ${text}`.replace(/\s+/g, ' ').trim()
                    : text;
                  return [
                    ...prev.slice(0, idx),
                    { ...existing, text: newText },
                    ...prev.slice(idx + 1),
                  ];
                }
                return [...prev, { id: openerId, role, text, screenId: sid, source: 'vapi' }];
              });
              notifyTranscriptListeners(evt);
              return;
            }
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (merge && last && last.role === role && last.screenId === sid) {
                // Glue with a space — Vapi already includes punctuation per fragment.
                const merged: VoiceMessage = {
                  ...last,
                  text: `${last.text} ${text}`.replace(/\s+/g, ' ').trim(),
                };
                return [...prev.slice(0, -1), merged];
              }
              return [
                ...prev,
                { id: `vapi-${evt.role}-${now}`, role, text, screenId: sid, source: 'vapi' },
              ];
            });
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
      // Merge persisted onboarding data UNDER the in-flight snapshot — mirrors
      // pushScreenContext. The chat page never calls setFormSnapshot, so without
      // this the cold-start opener ships with NO known-state and the coach
      // re-asks fields already captured (e.g. the nickname when rearming at fork).
      const persisted =
        qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state)?.data ?? {};
      const filled = { ...persisted, ...formSnapshotRef.current };

      // Instant-opener decision: only the FIRST Vapi-covered beat of the session
      // carries the cold-start latency, so only that call takes the silent-first
      // path (Cartesia speaks the opener, Vapi waits). Default OFF → this whole
      // block is dead and the standard speaks-first overrides ship unchanged.
      const isFirstColdStartBeat =
        ONBOARDING_INSTANT_OPENER && !openerUsedRef.current && isVapiCapableBeat(sid);

      const overrides = buildAssistantOverrides({
        screenId: ctx.screen_id,
        contextBlock: ctx.context_block,
        stateDelta: ctx.state_delta,
        filledFormState: filled,
        silentFirstMessage: isFirstColdStartBeat,
      });

      if (isFirstColdStartBeat) {
        // Mark the call so onCallStart mutes the Vapi mic on join and the mic
        // gate (opener ended AND Vapi joined) governs the unmute.
        openerUsedRef.current = true;
        instantOpenedScreenRef.current = sid;
        instantOpenerActiveRef.current = true;
        openerDoneRef.current = false;
        vapiJoinedRef.current = false;
        // Dead-mic failsafe: if neither gate ever resolves, force the mic open.
        clearOpenerFailsafe();
        openerFailsafeTimerRef.current = setTimeout(() => {
          openerFailsafeTimerRef.current = null;
          if (!instantOpenerActiveRef.current) return;
          instantOpenerActiveRef.current = false;
          const c = getClientRef.current();
          try {
            c?.setMuted(false);
          } catch (err) {
            if (import.meta.env.DEV)
              console.debug('[onboarding-voice] opener failsafe unmute skipped', err);
          }
        }, OPENER_FAILSAFE_MS);
        // Speak the beat's opener instantly via Cartesia, with the user's name
        // substituted. Falls back cleanly (resolves done) on any TTS failure so
        // the mic gate can never strand the call mic-closed.
        const nickname =
          typeof filled.nickname === 'string' ? (filled.nickname as string) : undefined;
        const openerBase = getOnboardingOpenerForState(sid, nickname) ?? '';
        const openerText = applyName(openerBase, nickname);
        // Route the Cartesia opener through the SAME message store as Vapi turns so
        // it renders from the transcript (not pre-rendered authored text) and gets
        // persisted (source 'opener'). Stable id per beat → dedup + mirror-once.
        if (openerText) {
          const openerMsg: VoiceMessage = {
            id: `opener-${sid}`,
            role: 'ai',
            text: openerText,
            screenId: sid,
            source: 'opener',
          };
          setMessages((prev) =>
            prev.some((m) => m.id === openerMsg.id) ? prev : [...prev, openerMsg],
          );
          // Mark spoken-this-session so a stray pre-user Vapi final accumulates into
          // the opener rather than replacing the Cartesia text.
          openerSpeakStartedRef.current.add(sid);
        }
        // Reset + drive the synced karaoke from the real Cartesia playback.
        openerRevealCountRef.current = -1;
        setOpenerReveal(openerText ? { screenId: sid, revealedWords: 0 } : null);
        const openerWordTotal = openerText.trim().split(/\s+/).filter(Boolean).length;
        const onOpenerProgress = (fraction: number) => {
          const c = Math.min(openerWordTotal, Math.round(fraction * openerWordTotal));
          if (c === openerRevealCountRef.current) return;
          openerRevealCountRef.current = c;
          setOpenerReveal({ screenId: sid, revealedWords: c });
        };
        stopOpener();
        // ~310ms/word spoken-cadence estimate, used only if the audio element
        // can't report a finite duration (Chrome blob-MP3 Infinity bug) so the
        // karaoke still reveals word-by-word instead of snapping to full.
        const openerEstMs = Math.max(1200, openerWordTotal * 310);
        const handle = speakOpener(openerText, onOpenerProgress, openerEstMs);
        openerHandleRef.current = handle;
        track('instant_opener_started', { screen_id: sid });
        void handle.done.then(() => {
          openerDoneRef.current = true;
          if (openerHandleRef.current === handle) openerHandleRef.current = null;
          // Snap the karaoke to the full line the instant the audio ends.
          openerRevealCountRef.current = openerWordTotal;
          setOpenerReveal({ screenId: sid, revealedWords: openerWordTotal });
          // The coach has now spoken (via Cartesia, since Vapi joined silent on
          // this beat). Mark it so the idle auto-pause timer arms — Vapi's
          // speech-start never fires on the silent-first path, so without this
          // the timer would never start and the live call would never pause.
          markAssistantSpoke();
          // Re-anchor the user-silence window to when the coach STOPPED
          // speaking. onCallStart seeded it at the silent Vapi join, but the
          // Cartesia opener kept playing after that; the 8s of "continuous user
          // silence" should be counted from the end of the opener, not the join.
          lastUserActivityAtRef.current = Date.now();
          maybeOpenMic();
        });
      }

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
  }, [qc, stopOpener, maybeOpenMic, markAssistantSpoke, clearOpenerFailsafe]);

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
      if (openerFailsafeTimerRef.current !== null) clearTimeout(openerFailsafeTimerRef.current);
      // Stop any in-flight instant-opener audio so it can't outlive the provider.
      if (openerHandleRef.current) {
        openerHandleRef.current.stop();
        openerHandleRef.current = null;
      }
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
      mode: 'replace' | 'append-if-empty' | 'append' = 'replace',
    ) => {
      if (threadScreenIdRef.current === screenId) return;
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

  // Single engine selector — Vapi / Direct-LLM / Soniox are all derived from ONE
  // decision so they can never overlap (no dual-init, no Vapi+Soniox mic contention).
  // The selector decides INTENT (orbs + beat + surface); Vapi health gates are
  // applied below when turning intent into vapiShouldBeLive.
  const rawOrbState = orbStateFrom(voiceOn, micOn);
  // Engine per beat is metadata-driven (node.meta.fill.brain), resolved by
  // screenId via beatEngineMeta; the legacy sets remain only as its fallback.
  const vapiCapableBeat = isVapiCapableBeat(registeredScreenId);
  const isLocalCaptureBeat = isIdleCaptureBeat(registeredScreenId);
  const engine = engineForTurn({
    inOnboarding,
    onChatPage,
    rawOrbState,
    voiceOn,
    micOn,
    chatVapiFlag: ONBOARDING_CHAT_VAPI,
    vapiCapableBeat,
    isLocalCaptureBeat,
    beatResolved: registeredScreenId !== null,
    hasScreen: !!currentScreenId,
  });
  // orbState for downstream consumers (useOnboardingChat inputMode + internal
  // guards + routeOrbSend): if the engine isn't Vapi, the dead chat-page 'vapi'
  // combo reads as voice_in_only (mic active, Direct-LLM owns the turn).
  const orbState: OrbState =
    engine.engine === 'vapi'
      ? 'vapi'
      : onChatPage && rawOrbState === 'vapi'
        ? 'voice_in_only'
        : rawOrbState;
  // Soniox runs iff the decision hands it the mic — never while Vapi owns it.
  const voiceInShouldBeLive = VOICE_IN_ENABLED && engine.micSource === 'soniox';

  const emitAssistant = useCallback(
    (text: string, kind: 'partial' | 'final') => {
      notifyTranscriptListeners({ role: 'assistant', kind, text });
    },
    [notifyTranscriptListeners],
  );

  const chatScreenId = activeSubScreenId ?? registeredScreenId ?? currentScreenId;
  // Direct-LLM runs only when the selector hands it the turn — mutually exclusive
  // with Vapi by construction (the selector never returns 'direct_llm' when Vapi owns it).
  const chatEnabled =
    engine.engine === 'direct_llm' &&
    !!chatScreenId &&
    chatScreenId.startsWith('ONBOARD-') &&
    (overlayOpen || voiceInShouldBeLive);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // A beat already has dialogue in the shared feed (e.g. Vapi spoke its opener) →
  // Direct-LLM must not re-stream that opener when it takes over (no duplicate bubble).
  const hasExistingTurn = useCallback(
    (sid: string) => messagesRef.current.some((m) => m.screenId === sid && !!m.text),
    [],
  );

  const {
    sendUserTurn,
    chatBusy,
    interrupt: interruptCoach,
    regenerate: regenerateCoach,
  } = useOnboardingChat({
    screenId: chatScreenId,
    enabled: chatEnabled,
    orbState,
    coachingStyle,
    appendMessage,
    startThread,
    emitAssistant,
    onVoiceAction: notifyVoiceActions,
    onAdvance: fireAdvance,
    chatNative: onChatPage,
    // Cartesia gate from the engine selector — always false on the chat page
    // (Vapi speaks itself); off the chat page the voice-out button drives TTS.
    speakReplies: engine.speakReplies,
    hasExistingTurn,
  });

  // End-of-turn aggregation (mirrors useCoachChat): Soniox streams a long
  // utterance as MULTIPLE finals ("my name is Jonas." / "my age is 26."). Sending
  // each immediately makes the 2nd final cancel the 1st turn mid-reply — dropping
  // its tool call (submit_profile). Buffer consecutive finals and flush as ONE
  // turn after an adaptive quiet gap.
  const utteranceBufferRef = useRef('');
  const aggregationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reply-guarantee (mirrors useCoachChat): a barge-in that cuts the coach
  // mid-reply sets `owesResponse`; if the user then adds NOTHING real (it was
  // echo/noise), the settle check regenerates the interrupted reply so Soniox
  // hearing the coach's own voice can never strand the coach in silence.
  const owesResponseRef = useRef(false);
  const regeneratedRef = useRef(false);
  const chatBusyRef = useRef(chatBusy);
  chatBusyRef.current = chatBusy;
  const flushUtterance = useCallback(() => {
    if (aggregationTimerRef.current) {
      clearTimeout(aggregationTimerRef.current);
      aggregationTimerRef.current = null;
    }
    const text = utteranceBufferRef.current.trim();
    utteranceBufferRef.current = '';
    if (!text) {
      // Barge-in produced no real user turn → re-answer the interrupted reply.
      if (owesResponseRef.current && !regeneratedRef.current) {
        owesResponseRef.current = false;
        regeneratedRef.current = true;
        regenerateCoach();
      }
      return;
    }
    owesResponseRef.current = false;
    regeneratedRef.current = false;
    sendUserTurn(text);
  }, [sendUserTurn, regenerateCoach]);
  const armFlush = useCallback(() => {
    if (aggregationTimerRef.current) clearTimeout(aggregationTimerRef.current);
    const pauseMs = resolveTurnPauseMs(utteranceBufferRef.current, {
      base: TURN_AGGREGATION_MS,
      complete: TURN_PAUSE_COMPLETE_MS,
      incomplete: TURN_PAUSE_INCOMPLETE_MS,
    });
    aggregationTimerRef.current = setTimeout(flushUtterance, pauseMs);
  }, [flushUtterance]);

  // Barge-in that records whether a reply was actually cut (so the settle check
  // can re-answer it) and ALWAYS arms a settle timer — even if no further speech
  // arrives, the guarantee still fires instead of leaving the coach silent.
  const bargeInterrupt = useCallback(() => {
    if (chatBusyRef.current || useTtsPlaybackStore.getState().isSpeaking) {
      owesResponseRef.current = true;
    }
    interruptCoach();
    if (!aggregationTimerRef.current) armFlush();
  }, [interruptCoach, armFlush]);

  const emitVoiceInInterim = useCallback(
    (text: string) => {
      // Barge-in on the first partial — cut the coach's audio/reply immediately
      // so it doesn't talk over the user (full-duplex, mirrors useCoachChat).
      bargeInterrupt();
      notifyTranscriptListeners({ role: 'user', kind: 'partial', text });
      // User still talking after a buffered final → defer the flush so we don't
      // cut the turn mid-thought.
      if (text.trim() && aggregationTimerRef.current) armFlush();
    },
    [notifyTranscriptListeners, bargeInterrupt, armFlush],
  );

  // Final voice turn → clear the live partial, barge-in, then BUFFER it; the
  // aggregation timer flushes the whole utterance to the LLM as one turn.
  const emitVoiceInFinal = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      notifyTranscriptListeners({ role: 'user', kind: 'final', text: trimmed });
      bargeInterrupt();
      utteranceBufferRef.current = utteranceBufferRef.current
        ? `${utteranceBufferRef.current} ${trimmed}`
        : trimmed;
      armFlush();
    },
    [notifyTranscriptListeners, bargeInterrupt, armFlush],
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

  // Full-duplex (mirrors useCoachChat): the mic stays hot during playback so the
  // user can barge in mid-reply — echo is handled by the browser's AEC, not by
  // muting. Mute only in half-duplex mode, plus a post-speech breath window to
  // cover the echo tail. Gates on actual playback (isSpeaking), not the fetch.
  const ttsSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  const micMutedForTts = !FULL_DUPLEX_BARGE_IN && voiceOn && ttsSpeaking;
  const [micMutedHeld, setMicMutedHeld] = useState(true);
  useEffect(() => {
    if (micMutedForTts) {
      setMicMutedHeld(true);
      return;
    }
    const t = setTimeout(() => setMicMutedHeld(false), MIC_GRACE_MS);
    return () => clearTimeout(t);
  }, [micMutedForTts]);
  const { isListening: voiceInListening } = useVoiceInCapture({
    active: voiceInShouldBeLive,
    vapiStatus: status,
    onTranscript: emitVoiceInFinal,
    onInterim: emitVoiceInInterim,
    responding: micMutedForTts || micMutedHeld,
    onError: handleVoiceInError,
  });

  useEffect(() => {
    if (!voiceInShouldBeLive) return;
    startKeyWarmLoop();
    return () => stopKeyWarmLoop();
  }, [voiceInShouldBeLive]);

  // Drop the aggregation buffer/timer when voice-in disarms or on unmount.
  useEffect(() => {
    if (voiceInShouldBeLive) return;
    if (aggregationTimerRef.current) {
      clearTimeout(aggregationTimerRef.current);
      aggregationTimerRef.current = null;
    }
    utteranceBufferRef.current = '';
  }, [voiceInShouldBeLive]);
  useEffect(
    () => () => {
      if (aggregationTimerRef.current) clearTimeout(aggregationTimerRef.current);
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

  // Idle auto-pause: after IDLE_TIMEOUT_MS of silence the idle timer calls
  // systemPauseMic(), which sets micPausedReason='system'. The Soniox path
  // already drops the mic off this flag via micEnabledFrom(); Vapi (mic + WebRTC)
  // must too, or the call stays fully live and keeps burning voice minutes. Read
  // the flag reactively so the vapiShouldBeLive derivation re-runs when it flips,
  // which tears the call down through the existing stop branch. A user gesture or
  // tab-visible event clears it (reactivateIfSystemPaused in App.tsx), flipping
  // this back to null so Vapi re-arms through the same start branch.
  const micPausedReason = useVoiceSettingsStore((s) => s.micPausedReason);

  // The selector decides Vapi INTENT (voice on, covered beat). Vapi only STARTS
  // once the mic is actually granted — until then the beat is Vapi-pending (the
  // opener waits for Vapi, Direct-LLM never fills it). Plus the transient health
  // gates: identity loaded, no fatal/cooldown, under the daily cap, not idle-paused.
  // The gate is a pure helper (vapiLiveGate) so it can be unit-tested.
  const gateInputs = {
    engineIsVapi: engine.engine === 'vapi',
    micPermission: preferences.micPermission === true,
    micEnabled: preferences.micEnabled === true,
    hasAnonId: !!anonId,
    fatalError: fatalErrorRef.current,
    remoteEndCooldown,
    voiceCapReached,
    micPausedReason,
  };
  const vapiShouldBeLive = vapiLiveGate(gateInputs);

  useEffect(() => {
    vapiShouldBeLiveRef.current = vapiShouldBeLive;
    // Name WHICH condition is keeping Vapi down — turns "the gate is buggy" into
    // a single readable line per transition. The blockers list is the failing
    // conjuncts of vapiLiveGate (engineIsVapi/micPermission/micEnabled/hasAnonId
    // must be true; fatalError/remoteEndCooldown/voiceCapReached/idle-pause must
    // be false).
    if (import.meta.env.DEV) {
      const blockers = [
        !gateInputs.engineIsVapi && `engine=${engine.engine}(not-vapi)`,
        !gateInputs.micPermission && 'micPermission=false',
        !gateInputs.micEnabled && 'micEnabled=false',
        !gateInputs.hasAnonId && 'anonId=missing',
        gateInputs.fatalError && 'fatalError',
        gateInputs.remoteEndCooldown && 'remoteEndCooldown',
        gateInputs.voiceCapReached && 'voiceCapReached',
        gateInputs.micPausedReason != null && `micPaused=${gateInputs.micPausedReason}`,
      ].filter(Boolean);
      console.log(
        `[vapi-gate] live=${vapiShouldBeLive}`,
        blockers.length ? `blockers: ${blockers.join(', ')}` : '(all clear)',
        `screen=${registeredScreenId}`,
      );
    }
  }, [vapiShouldBeLive]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isSpeaking) markAssistantSpoke();
  }, [isSpeaking, markAssistantSpoke]);

  useEffect(() => {
    if (status !== 'active' && status !== 'connecting') {
      clearAssistantSpoke();
    }
  }, [status, clearAssistantSpoke]);

  // Arms (or re-arms) the idle timer to fire when IDLE_TIMEOUT_MS of CONTINUOUS
  // USER silence has elapsed. The delay is computed from lastUserActivityAtRef,
  // not from "now", so re-arming after an assistant re-prompt (state
  // speaking→listening) does NOT restart the full window — it schedules for the
  // remaining time. When the timer fires it re-checks the elapsed user silence:
  // if the user spoke in the meantime it reschedules for the leftover, otherwise
  // it tears Vapi down. This is the core of the "measure from last user turn,
  // survive the assistant nudge" fix — a Vapi re-prompt at ~7.5s no longer
  // pre-empts the pause at 8s of genuine user silence.
  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    // Defensive: no user activity recorded yet this call (onCallStart and the
    // opener-done callback both seed it, but anchor to now if neither ran).
    if (lastUserActivityAtRef.current === 0) {
      lastUserActivityAtRef.current = Date.now();
    }
    const fire = () => {
      idleTimerRef.current = null;
      if (pendingRef.current !== null) return;
      if (!isUserSilenceElapsed(lastUserActivityAtRef.current, Date.now(), IDLE_TIMEOUT_MS)) {
        // The user spoke since this timer was armed — not actually idle yet.
        // Reschedule for the remaining silence instead of pausing.
        idleTimerRef.current = setTimeout(
          fire,
          idleSilenceRemainingMs(lastUserActivityAtRef.current, Date.now(), IDLE_TIMEOUT_MS),
        );
        return;
      }
      useVoiceSettingsStore.getState().systemPauseMic();
    };
    const remaining = idleSilenceRemainingMs(
      lastUserActivityAtRef.current,
      Date.now(),
      IDLE_TIMEOUT_MS,
    );
    idleTimerRef.current = setTimeout(fire, remaining);
  }, [clearIdleTimer]);

  useEffect(() => {
    if (!shouldArmIdleTimer({ status, state, assistantHasSpoken })) {
      clearIdleTimer();
      return;
    }
    armIdleTimer();
    return clearIdleTimer;
  }, [status, state, assistantHasSpoken, clearIdleTimer, armIdleTimer]);

  useEffect(() => {
    if (status !== 'active') return;
    const screenToFetch = activeSubScreenId ?? registeredScreenId ?? currentScreenId;
    if (!screenToFetch) return;
    if (lastPushedScreenIdRef.current === screenToFetch) return;
    if (deferredScreenContextRef.current.has(screenToFetch)) return;
    const priorTs = lastScreenChangeTsRef.current;
    lastScreenChangeTsRef.current = new Date().toISOString();
    // A screen change triggers a fresh assistant turn (pushScreenContext sends
    // triggerResponseEnabled). End the current turn so the new screen's opening
    // line starts its own bubble instead of gluing onto the previous screen's.
    assistantTurnOpenRef.current = false;
    lastTurnRoleRef.current = null;
    closeMergeWindow();
    void pushScreenContext(screenToFetch, priorTs);
  }, [
    status,
    currentScreenId,
    activeSubScreenId,
    registeredScreenId,
    deferredScreenContextVersion,
    pushScreenContext,
    closeMergeWindow,
  ]);

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
      openerReveal,
      appendMessage,
      startThread,
      sendUserTurn,
      chatBusy,
      assistantMergeOpen,
      subscribeVoiceActions,
      registerScreen,
      registerAdvance,
      setScreenContextDeferred,
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
      openerReveal,
      appendMessage,
      startThread,
      sendUserTurn,
      chatBusy,
      subscribeVoiceActions,
      registerScreen,
      registerAdvance,
      setScreenContextDeferred,
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
      {inOnboarding && overlayOpen && !onChatPage && (
        <OnboardingChatOverlay onClose={closeOverlay} />
      )}
      <VoiceCapModal />
    </OnboardingVoiceContext.Provider>
  );
}
