import Vapi from '@vapi-ai/web';
import type { AssistantOverrides } from '@vapi-ai/web/dist/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import type { ReleaseToken, Surface } from '@/contexts/voiceContextDef';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useVoice } from '@/hooks/useVoice';

export type RealtimeVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

// Vapi events sometimes hand back an object instead of an Error or string;
// String() on a plain object yields "[object Object]", which then leaks into
// the UI. Walk the common shapes before falling back to a stable label.
function errorToMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const obj = err as { message?: unknown; error?: unknown; statusText?: unknown };
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.statusText === 'string') return obj.statusText;
    if (typeof obj.error === 'string') return obj.error;
    if (obj.error && typeof obj.error === 'object') {
      const inner = (obj.error as { message?: unknown }).message;
      if (typeof inner === 'string') return inner;
    }
  }
  return fallback;
}

export type CoachingStyle = 'warm' | 'direct' | 'reflective';

export type RealtimeTranscriptRole = 'user' | 'assistant';
export type RealtimeTranscriptKind = 'partial' | 'final';

export interface RealtimeTranscriptEvent {
  role: RealtimeTranscriptRole;
  kind: RealtimeTranscriptKind;
  text: string;
}

export interface UseRealtimeVoiceMetadata {
  anon_id: string;
  screen?: string;
  coaching_style?: CoachingStyle;
}

export interface UseRealtimeVoiceOptions {
  metadata: UseRealtimeVoiceMetadata;
  onEnd?: () => void;
  onError?: (message: string) => void;
  startAudioOff?: boolean;
  onCallStart?: () => void;
  // Fires on any user-side transcript event (partial or final). Used by the
  // provider to reset its idle timer — Vapi's speech-start/-end are assistant-
  // side only, so without this signal the timer treats user talking as idle.
  onUserActivity?: () => void;
  // Fires for every transcript event from Vapi (both user STT and assistant
  // TTS, partial and final). The provider fans this out to the chat overlay
  // so the conversation can be rendered as bubbles.
  onTranscript?: (event: RealtimeTranscriptEvent) => void;
  // Optional per-call assistantOverrides builder. Called inside start() right
  // before vapi.start(); resolves to undefined to fall back to the dashboard
  // assistant config (static firstMessage). Used to inject screen context +
  // state_delta so the very first utterance is contextual instead of the
  // generic "Hi welcome to…" line on the assistant config.
  getAssistantOverrides?: () => Promise<Partial<AssistantOverrides> | undefined>;
}

export interface UseRealtimeVoiceReturn {
  start: () => Promise<void>;
  stop: () => void;
  state: RealtimeVoiceState;
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  getClient: () => Vapi | null;
}

const PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string | undefined;

type VoiceContext = 'checkin' | 'conversation' | 'onboarding' | 'habit_create' | 'feedback';
function deriveContext(screen?: string): VoiceContext {
  if (!screen) return 'conversation';
  if (screen.startsWith('onboard_')) return 'onboarding';
  if (screen === 'morning' || screen === 'evening') return 'checkin';
  if (screen === 'habit_create') return 'habit_create';
  if (screen === 'feedback') return 'feedback';
  return 'conversation';
}

function deriveSurface(screen?: string): Surface {
  if (!screen) return 'chat';
  if (screen.startsWith('onboard_')) return 'onboarding';
  if (screen === 'morning') return 'morning';
  if (screen === 'evening') return 'evening';
  if (screen === 'habit_create') return 'habit_create';
  if (screen === 'feedback') return 'feedback';
  return 'chat';
}

const SCREEN_ID_CANONICAL: Record<string, string | null> = {
  onboard_01: 'ONBOARD-01',
  onboard_02: 'ONBOARD-FORK',
  onboard_03: 'ONBOARD-BEGINNER-01',
  onboard_04: 'ONBOARD-BEGINNER-02',
  onboard_05: 'ONBOARD-BEGINNER-03',
  onboard_06: 'ONBOARD-BEGINNER-04',
  onboard_07: 'STARTING-PLAN',
  onboard_08: 'ONBOARD-BEGINNER-07',
  onboard_advanced_input: 'ONBOARD-ADVANCED',
  onboard_advanced_results: 'ONBOARD-ADVANCED-02',
  onboard_advanced_step_6: 'ONBOARD-ADVANCED-04',
  onboard_advanced_custom_prompts: 'ONBOARD-ADVANCED-05',
  morning: 'MCHECK-01',
  evening: 'ECHECK-01',
  habit_create: 'HABIT-CREATE-FORK',
  feedback: null,
};

function toCanonicalScreenId(screen?: string): string | undefined {
  if (!screen) return undefined;
  if (screen in SCREEN_ID_CANONICAL) {
    const mapped = SCREEN_ID_CANONICAL[screen];
    return mapped ?? undefined;
  }
  return screen.toUpperCase().replace(/_/g, '-');
}

/**
 * Vapi-backed realtime voice for Path 1 onboarding. Owns the @vapi-ai/web
 * client lifecycle, telemetry (PostHog + session_log), VoiceContext token
 * plumbing, and the spec-named state fields.
 */
export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const {
    metadata,
    onEnd,
    onError,
    startAudioOff,
    onCallStart,
    onUserActivity,
    onTranscript,
    getAssistantOverrides,
  } = options;
  const { acquireRealtime, releaseToken, setStatus: setOwnerPhase } = useVoice();
  const { startVoice, endVoice } = useSessionLog();

  const [state, setState] = useState<RealtimeVoiceState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const vapiRef = useRef<Vapi | null>(null);
  const stateRef = useRef<RealtimeVoiceState>('idle');
  const tearingDownRef = useRef(false);
  // In-flight stop promise. Daily SDK fires "multiple call instances" if a
  // new start() races a still-tearing-down call — start() awaits this first.
  const teardownPromiseRef = useRef<Promise<void> | null>(null);
  const startInvokedAtRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const firstAudioMsRef = useRef<number | null>(null);
  const turnCountRef = useRef<number>(0);
  const transcriptCharsRef = useRef<number>(0);
  const transcriptWarnedRef = useRef(false);
  const hadErrorRef = useRef(false);
  const voiceAnchorIdRef = useRef<string | null>(null);
  const tokenRef = useRef<ReleaseToken | null>(null);

  // Listeners are attached to the Vapi instance ONCE (we reuse one instance
  // for the hook's lifetime — see the comment in start()). They must call the
  // latest option callbacks, not the ones captured at attach time, so we
  // route through refs that get re-synced every render.
  const onCallStartRef = useRef(onCallStart);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  const onUserActivityRef = useRef(onUserActivity);
  const onTranscriptRef = useRef(onTranscript);
  const getAssistantOverridesRef = useRef(getAssistantOverrides);
  const metadataRef = useRef(metadata);
  useEffect(() => {
    onCallStartRef.current = onCallStart;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
    onUserActivityRef.current = onUserActivity;
    onTranscriptRef.current = onTranscript;
    getAssistantOverridesRef.current = getAssistantOverrides;
    metadataRef.current = metadata;
  });

  const dropToken = useCallback(() => {
    const t = tokenRef.current;
    if (!t) return;
    tokenRef.current = null;
    releaseToken(t);
  }, [releaseToken]);

  const setStateSynced = useCallback((next: RealtimeVoiceState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const cleanup = useCallback(() => {
    if (tearingDownRef.current) return;
    tearingDownRef.current = true;

    if (sessionStartRef.current !== null) {
      const ctx = deriveContext(metadata.screen);
      const duration_seconds = (performance.now() - sessionStartRef.current) / 1000;
      if (hadErrorRef.current) {
        track('cancel_voice_session', {
          context: ctx,
          duration_seconds,
          reason: 'error',
          voice_vendor: 'vapi',
        });
        if (voiceAnchorIdRef.current) {
          endVoice(voiceAnchorIdRef.current, 'error');
          voiceAnchorIdRef.current = null;
        }
      } else {
        track('complete_voice_session', {
          context: ctx,
          duration_seconds,
          transcript_length_chars: transcriptCharsRef.current,
          turn_count: turnCountRef.current,
          voice_vendor: 'vapi',
          vapi_first_audio_ms: firstAudioMsRef.current,
        });
        if (voiceAnchorIdRef.current) {
          endVoice(voiceAnchorIdRef.current, 'user_exit', { turn_count: turnCountRef.current });
          voiceAnchorIdRef.current = null;
        }
      }
      sessionStartRef.current = null;
      turnCountRef.current = 0;
      transcriptCharsRef.current = 0;
      firstAudioMsRef.current = null;
      hadErrorRef.current = false;
    }

    startInvokedAtRef.current = null;
    transcriptWarnedRef.current = false;

    // Stop the active call but KEEP the Vapi instance + its listeners.
    // Daily refuses more than one DailyIframe call object on a page; if we
    // destroy the Vapi instance and construct a new one for the next start,
    // it fails with "Duplicate DailyIframe instances are not allowed" because
    // Daily's strict-mode guard fires before the previous instance's slot
    // is fully released. Vapi.start() internally calls cleanup() to destroy
    // the old Daily call before creating a new one — exactly what we need —
    // so the canonical pattern is one Vapi instance, repeated start/stop.
    // The instance is only fully torn down on hook unmount.
    const client = vapiRef.current;
    if (client) {
      const stopP = client.stop().catch(() => {
        /* noop */
      });
      teardownPromiseRef.current = stopP;
      void stopP.finally(() => {
        if (teardownPromiseRef.current === stopP) {
          teardownPromiseRef.current = null;
        }
      });
    }

    tearingDownRef.current = false;
  }, [metadata.screen, endVoice]);

  const stop = useCallback(() => {
    if (tearingDownRef.current) return;
    cleanup();
    setStateSynced('idle');
    dropToken();
    onEnd?.();
  }, [cleanup, dropToken, onEnd, setStateSynced]);

  const fail = useCallback(
    (message: string) => {
      if (import.meta.env.DEV) {
        console.error('[vapi] fail:', message);
      }
      hadErrorRef.current = true;
      setError(message);
      cleanup();
      dropToken();
      setStateSynced('error');
      onError?.(message);
    },
    [cleanup, dropToken, onError, setStateSynced],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      dropToken();
      // Full teardown on unmount only — disconnects listeners and clears the
      // Vapi instance so the next mount can lazy-create a fresh one. Inside
      // the hook's lifetime, cleanup() keeps the instance alive on purpose.
      const client = vapiRef.current;
      vapiRef.current = null;
      if (client) {
        try {
          client.removeAllListeners();
        } catch {
          /* noop */
        }
        void client.stop().catch(() => {
          /* noop */
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (tearingDownRef.current) return;
    // Don't double-start an active or in-progress call. We previously gated
    // on `vapiRef.current` being non-null, but the instance now persists
    // across stop/start cycles — gate on state instead.
    if (stateRef.current !== 'idle' && stateRef.current !== 'error') return;

    // Wait out any in-flight stop. Vapi.stop() awaits Daily's destroy, so once
    // this resolves the same Vapi instance is ready to start() again with a
    // fresh Daily call object — no settle delay or duplicate-instance race.
    if (teardownPromiseRef.current) {
      await teardownPromiseRef.current;
      if (!mountedRef.current || tearingDownRef.current) return;
    }

    if (!PUBLIC_KEY || !ASSISTANT_ID) {
      const msg = 'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID.';
      setError(msg);
      onErrorRef.current?.(msg);
      setStateSynced('error');
      return;
    }

    const ownerToken = acquireRealtime({
      surface: deriveSurface(metadata.screen),
      onCleanup: () => {
        tokenRef.current = null;
        if (!mountedRef.current || tearingDownRef.current) return;
        cleanup();
        setStateSynced('idle');
        onEndRef.current?.();
      },
    });
    if (!ownerToken) {
      const msg = 'Could not acquire the voice channel.';
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }
    tokenRef.current = ownerToken;
    setError(null);
    setStateSynced('connecting');
    startInvokedAtRef.current = performance.now();

    // Lazy-create the Vapi instance once per hook lifetime, attaching all
    // listeners only on this first creation. Listeners read the latest option
    // callbacks via `*Ref.current` so reuse doesn't trap them with stale
    // closures over old props.
    if (!vapiRef.current) {
      const client = new Vapi(
        PUBLIC_KEY,
        undefined,
        undefined,
        startAudioOff ? { startAudioOff: true } : undefined,
      );
      vapiRef.current = client;

      client.on('call-start', () => {
        if (!mountedRef.current || tearingDownRef.current) return;
        sessionStartRef.current = performance.now();
        turnCountRef.current = 0;
        transcriptCharsRef.current = 0;
        hadErrorRef.current = false;
        const screen = metadataRef.current.screen;
        track('start_voice_session', {
          context: deriveContext(screen),
          screen: screen ?? null,
          voice_mode: 'realtime',
          voice_vendor: 'vapi',
        });
        voiceAnchorIdRef.current = startVoice(toCanonicalScreenId(screen), {
          voice_vendor: 'vapi',
        });
        setStateSynced('listening');
        const t = tokenRef.current;
        if (t) setOwnerPhase(t, 'listening');
        try {
          onCallStartRef.current?.();
        } catch (err) {
          console.warn('[vapi] onCallStart threw:', err);
        }
      });

      client.on('speech-start', () => {
        if (!mountedRef.current || tearingDownRef.current) return;
        if (stateRef.current !== 'speaking') {
          turnCountRef.current += 1;
          if (firstAudioMsRef.current === null && startInvokedAtRef.current !== null) {
            firstAudioMsRef.current = performance.now() - startInvokedAtRef.current;
          }
          setStateSynced('speaking');
          const t = tokenRef.current;
          if (t) setOwnerPhase(t, 'speaking');
        }
      });

      client.on('speech-end', () => {
        if (!mountedRef.current || tearingDownRef.current) return;
        setStateSynced('listening');
        const t = tokenRef.current;
        if (t) setOwnerPhase(t, 'listening');
      });

      client.on('message', (message: unknown) => {
        try {
          const m = message as {
            type?: string;
            transcriptType?: string;
            transcript?: unknown;
            role?: string;
          };
          if (m?.type !== 'transcript') return;
          // Any user transcript (partial or final) counts as activity —
          // keeps the provider's idle timer from killing a call mid-thought.
          if (m.role === 'user') onUserActivityRef.current?.();
          const text = m.transcript;
          if (typeof text !== 'string' || text.length === 0) return;
          const kind: RealtimeTranscriptKind = m.transcriptType === 'final' ? 'final' : 'partial';
          const role: RealtimeTranscriptRole = m.role === 'assistant' ? 'assistant' : 'user';
          // Fan out before the final-only gate so chat overlay can render
          // partial bubbles too.
          try {
            onTranscriptRef.current?.({ role, kind, text });
          } catch (err) {
            console.warn('[vapi] onTranscript threw:', err);
          }
          if (kind !== 'final') return;
          transcriptCharsRef.current += text.length;
        } catch {
          if (!transcriptWarnedRef.current) {
            transcriptWarnedRef.current = true;
            console.warn('[vapi] transcript message parse failed; transcript_length_chars=0');
          }
        }
      });

      client.on('error', (err: unknown) => {
        fail(errorToMessage(err, 'Unknown Vapi error'));
      });

      client.on('call-start-failed', (evt) => {
        fail(errorToMessage(evt?.error, 'Vapi call-start failed.'));
      });

      client.on('call-end', () => {
        if (tearingDownRef.current) return;
        // Skip call-end fired by our own stop() — state is already 'idle' or
        // 'error' in that case, and a redundant stop() would flip endedFlag
        // back to false via onEnd, fooling the provider's status mapping.
        if (stateRef.current === 'idle' || stateRef.current === 'error') return;
        stop();
      });
    }

    const client = vapiRef.current;

    // Build per-call overrides (screen context + state_delta as a system
    // message + firstMessageMode flip). On any failure, fall back to the
    // assistant's dashboard config — the static firstMessage is preferable
    // to no call at all.
    let extraOverrides: Partial<AssistantOverrides> | undefined;
    try {
      extraOverrides = await getAssistantOverridesRef.current?.();
    } catch (err) {
      console.warn(
        '[vapi] getAssistantOverrides threw, falling back to dashboard firstMessage:',
        err,
      );
    }

    // Per-call session id. Surfaces in tool-call payloads via Vapi static
    // params so server handlers can correlate tool writes with a single call.
    const sessionId = crypto.randomUUID();

    try {
      await client.start(ASSISTANT_ID, {
        ...(extraOverrides ?? {}),
        // Merge variableValues so override-supplied variables (e.g.
        // `initial_screen_context` from buildAssistantOverrides) coexist with
        // the per-call identity/screen variables. The base values win on key
        // collisions — they're load-bearing for the Vapi assistant prompt.
        variableValues: {
          ...(extraOverrides?.variableValues ?? {}),
          anon_id: metadata.anon_id,
          // dual-field for one deploy cycle; drop user_id in follow-up MR
          user_id: metadata.anon_id,
          session_id: sessionId,
          screen: metadata.screen ?? '',
          canonical_screen_id: toCanonicalScreenId(metadata.screen) ?? '',
          coaching_style: metadata.coaching_style ?? 'warm',
        },
      });
    } catch (err) {
      if (!mountedRef.current) return;
      fail(err instanceof Error ? err.message : 'Failed to start Vapi call.');
    }
  }, [
    acquireRealtime,
    cleanup,
    fail,
    metadata,
    setOwnerPhase,
    setStateSynced,
    startAudioOff,
    startVoice,
    stop,
  ]);

  const getClient = useCallback<() => Vapi | null>(() => vapiRef.current, []);

  return {
    start,
    stop,
    state,
    isActive: state === 'listening' || state === 'thinking' || state === 'speaking',
    isListening: state === 'listening',
    isSpeaking: state === 'speaking',
    error,
    getClient,
  };
}
