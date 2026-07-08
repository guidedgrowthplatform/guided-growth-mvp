import Vapi from '@vapi-ai/web';
import type { AssistantOverrides } from '@vapi-ai/web/dist/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import type { ReleaseToken, Surface } from '@/contexts/voiceContextDef';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useVoice } from '@/hooks/useVoice';
import { emitLatencySpan } from '@/lib/telemetry/latencySpans';

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

type CoachingStyle = 'warm' | 'direct' | 'reflective';

/**
 * Once-per-teardown latch for onEnd. A local stop() tears the call down through
 * two paths that BOTH try to fire onEnd: dropToken() -> releaseToken() runs the
 * token's onCleanup synchronously (fires once), and stop() then calls onEnd
 * directly (would fire again). The second fire reads to the provider as a REMOTE
 * end and arms a ~3s cooldown that blocks toggling voice off then on. `fire()`
 * runs the callback at most once until `arm()` is called for the next call.
 */
export function createOnEndLatch(onEnd: () => void): { fire: () => void; arm: () => void } {
  let fired = false;
  return {
    fire: () => {
      if (fired) return;
      fired = true;
      onEnd();
    },
    arm: () => {
      fired = false;
    },
  };
}

type RealtimeTranscriptRole = 'user' | 'assistant';
type RealtimeTranscriptKind = 'partial' | 'final';

export interface RealtimeTranscriptEvent {
  role: RealtimeTranscriptRole;
  kind: RealtimeTranscriptKind;
  text: string;
}

interface UseRealtimeVoiceMetadata {
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
  // Which Vapi assistant to start the call on. Defaults to the onboarding
  // assistant (VITE_VAPI_ASSISTANT_ID) — every existing call site is
  // unaffected. Pass 'weekly' to start on VITE_VAPI_WEEKLY_ASSISTANT_ID
  // instead (The Weekly runs on its own dedicated assistant, separate from
  // onboarding — see gg-spec/docs/the-weekly.md). The actual mounting of The
  // Weekly onto a live Vapi call happens at the live-surface seam (the
  // session that wires weekly-checkin-v1 into a real call); this option
  // exists so that seam doesn't need to touch this hook's internals.
  assistant?: 'onboarding' | 'weekly';
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
  /**
   * B51: real-time assistant playback amplitude, 0..1, straight from Vapi's
   * own `volume-level` event (the actual TTS output level — Vapi's audio is a
   * Daily/WebRTC-owned element the app doesn't create, so this SDK event is
   * the only real (non-synthesized) amplitude signal available for it).
   * 0 whenever the assistant isn't speaking.
   */
  assistantVolumeLevel: number;
  /**
   * B51: real-time user mic amplitude, 0..1, from Daily's local-audio-level
   * observer (`DailyCall.startLocalAudioLevelObserver`). Unlike
   * audioMetricsStore's RMS (fed only by Soniox, which never runs while Vapi
   * owns the mic), this is real data during an actual Vapi call. 0 when no
   * call is active or the observer hasn't reported yet.
   */
  userAudioLevel: number;
}

const PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string | undefined;
// The Weekly's dedicated assistant (optional — unset until the live-surface
// seam actually starts a call with `assistant: 'weekly'`).
const WEEKLY_ASSISTANT_ID = import.meta.env.VITE_VAPI_WEEKLY_ASSISTANT_ID as string | undefined;

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
    assistant = 'onboarding',
  } = options;
  const { acquireRealtime, releaseToken, setStatus: setOwnerPhase } = useVoice();
  const { startVoice, endVoice } = useSessionLog();

  const [state, setState] = useState<RealtimeVoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  // B51: real Vapi/Daily amplitude signals (see UseRealtimeVoiceReturn docs).
  const [assistantVolumeLevel, setAssistantVolumeLevel] = useState(0);
  const [userAudioLevel, setUserAudioLevel] = useState(0);

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

  // onEnd must fire exactly once per teardown. A local stop() runs cleanup() then
  // dropToken() -> releaseToken() which SYNCHRONOUSLY re-invokes the token's
  // onCleanup (calling onEnd), and stop() then calls onEnd AGAIN directly. The
  // second call looks like a REMOTE end to the provider (didCallStopRef was
  // already consumed by the first), which arms a ~3s remote-end cooldown that
  // blocks toggling voice off then on. Latch onEnd so the second invocation in
  // the same teardown is a no-op; arm() re-enables it for each new start().
  const onEndLatchRef = useRef(createOnEndLatch(() => onEndRef.current?.()));
  const fireOnEndOnce = useCallback(() => onEndLatchRef.current.fire(), []);

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

    // B51: stop the Daily local-audio-level observer before the call tears
    // down (best-effort — the call itself is being destroyed either way) and
    // drop both amplitude signals so a stale value can't linger into idle.
    try {
      const daily = vapiRef.current?.getDailyCallObject();
      if (daily?.isLocalAudioLevelObserverRunning()) {
        daily.stopLocalAudioLevelObserver();
      }
    } catch {
      /* best-effort only */
    }
    setAssistantVolumeLevel(0);
    setUserAudioLevel(0);

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
    // dropToken() runs the token's onCleanup synchronously, which already fires
    // onEnd (latched). This second call is the no-op guarded by fireOnEndOnce:
    // it only does real work when no token was held (dropToken early-returned).
    dropToken();
    fireOnEndOnce();
  }, [cleanup, dropToken, fireOnEndOnce, setStateSynced]);

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

    const resolvedAssistantId = assistant === 'weekly' ? WEEKLY_ASSISTANT_ID : ASSISTANT_ID;
    if (!PUBLIC_KEY || !resolvedAssistantId) {
      const msg =
        assistant === 'weekly'
          ? 'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_WEEKLY_ASSISTANT_ID.'
          : 'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID.';
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
        fireOnEndOnce();
      },
    });
    if (!ownerToken) {
      const msg = 'Could not acquire the voice channel.';
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }
    tokenRef.current = ownerToken;
    // Re-arm the once-per-teardown latch: this is a fresh call, so its eventual
    // teardown is allowed to fire onEnd again.
    onEndLatchRef.current.arm();
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
        // This hook powers first-run ONBOARDING realtime voice only (single
        // call site: OnboardingVoiceProvider). Its starts are cap-exempt so
        // onboarding never consumes the daily Vapi cap (see VAPI_DAILY_CAP /
        // CAP_EXEMPT_PAYLOAD_KEY in lib/config/voice). If this hook is ever
        // reused for non-onboarding (coach) voice, gate cap_exempt on an option.
        voiceAnchorIdRef.current = startVoice(toCanonicalScreenId(screen), {
          voice_vendor: 'vapi',
          cap_exempt: true,
        });
        setStateSynced('listening');
        const t = tokenRef.current;
        if (t) setOwnerPhase(t, 'listening');
        // B51: user-mic amplitude for the orb. audioMetricsStore's RMS is fed
        // only by Soniox, which never runs while Vapi owns the mic (see
        // OnboardingVoiceProvider's voiceInShouldBeLive comment), so during a
        // real Vapi call there is otherwise no live user-side signal at all.
        // Daily's local-audio-level observer is the actual mic level Vapi's
        // own transport already computes. Best-effort: a missing Daily object
        // or an observer failure just means the orb's user-mic side stays
        // flat, never breaks the call.
        try {
          const daily = client.getDailyCallObject();
          if (daily && !daily.isLocalAudioLevelObserverRunning()) {
            daily.on('local-audio-level', (evt) => {
              if (!mountedRef.current || tearingDownRef.current) return;
              const lvl = evt.audioLevel;
              setUserAudioLevel(Number.isFinite(lvl) ? Math.max(0, Math.min(1, lvl)) : 0);
            });
            void daily.startLocalAudioLevelObserver().catch((err) => {
              console.warn('[vapi] startLocalAudioLevelObserver failed', err);
            });
          }
        } catch (err) {
          console.warn('[vapi] local audio level observer setup failed', err);
        }
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
            // Latency lane T1: previously this value only shipped inside
            // complete_voice_session at session end; emit at occurrence too so
            // cold-start latency is visible even for sessions that never end
            // cleanly. Measurement only, no behavior change.
            emitLatencySpan('vapi_first_audio_ms', firstAudioMsRef.current, {
              voice_vendor: 'vapi',
            });
          }
          setStateSynced('speaking');
          const t = tokenRef.current;
          if (t) setOwnerPhase(t, 'speaking');
        }
      });

      client.on('speech-end', () => {
        if (!mountedRef.current || tearingDownRef.current) return;
        setStateSynced('listening');
        setAssistantVolumeLevel(0);
        const t = tokenRef.current;
        if (t) setOwnerPhase(t, 'listening');
      });

      // B51: assistant playback amplitude (real Vapi TTS output level), so the
      // in-flow orb can pulse to the actual coach audio instead of sitting
      // static. Fires continuously while the assistant is speaking; Vapi does
      // not guarantee a final 0 on speech-end, so speech-end above and the
      // stop() path both also clear it defensively.
      client.on('volume-level', (volume: number) => {
        if (!mountedRef.current || tearingDownRef.current) return;
        setAssistantVolumeLevel(Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0);
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
      await client.start(resolvedAssistantId, {
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
    assistant,
    cleanup,
    fail,
    fireOnEndOnce,
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
    assistantVolumeLevel,
    userAudioLevel,
  };
}
