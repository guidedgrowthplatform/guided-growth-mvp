import Vapi from '@vapi-ai/web';
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

export type CoachingStyle = 'warm' | 'direct' | 'reflective';

export interface UseRealtimeVoiceMetadata {
  user_id: string;
  screen?: string;
  coaching_style?: CoachingStyle;
}

export interface UseRealtimeVoiceOptions {
  metadata: UseRealtimeVoiceMetadata;
  onEnd?: () => void;
  onError?: (message: string) => void;
  startAudioOff?: boolean;
  onCallStart?: () => void;
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
  const { metadata, onEnd, onError, startAudioOff, onCallStart } = options;
  const { acquireRealtime, releaseToken, setStatus: setOwnerPhase } = useVoice();
  const { startVoice, endVoice } = useSessionLog();

  const [state, setState] = useState<RealtimeVoiceState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const vapiRef = useRef<Vapi | null>(null);
  const stateRef = useRef<RealtimeVoiceState>('idle');
  const tearingDownRef = useRef(false);
  const startInvokedAtRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const firstAudioMsRef = useRef<number | null>(null);
  const turnCountRef = useRef<number>(0);
  const transcriptCharsRef = useRef<number>(0);
  const transcriptWarnedRef = useRef(false);
  const hadErrorRef = useRef(false);
  const voiceAnchorIdRef = useRef<string | null>(null);
  const tokenRef = useRef<ReleaseToken | null>(null);

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

    // Null the ref BEFORE SDK teardown so call-end firing synchronously
    // from inside client.stop() doesn't re-enter handlers we already wired.
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

    setStateSynced('idle');
    tearingDownRef.current = false;
  }, [setStateSynced, metadata.screen, endVoice]);

  const stop = useCallback(() => {
    if (tearingDownRef.current) return;
    cleanup();
    dropToken();
    onEnd?.();
  }, [cleanup, dropToken, onEnd]);

  const fail = useCallback(
    (message: string) => {
      hadErrorRef.current = true;
      setError(message);
      setStateSynced('error');
      cleanup();
      dropToken();
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (tearingDownRef.current) return;
    if (vapiRef.current) return;

    if (!PUBLIC_KEY || !ASSISTANT_ID) {
      const msg = 'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID.';
      setError(msg);
      onError?.(msg);
      setStateSynced('error');
      return;
    }

    const ownerToken = acquireRealtime({
      surface: deriveSurface(metadata.screen),
      onCleanup: () => {
        tokenRef.current = null;
        if (!mountedRef.current || tearingDownRef.current) return;
        cleanup();
        onEnd?.();
      },
    });
    if (!ownerToken) {
      const msg = 'Could not acquire the voice channel.';
      setError(msg);
      onError?.(msg);
      return;
    }
    tokenRef.current = ownerToken;
    setError(null);
    setStateSynced('connecting');
    startInvokedAtRef.current = performance.now();

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
      track('start_voice_session', {
        context: deriveContext(metadata.screen),
        screen: metadata.screen ?? null,
        voice_mode: 'realtime',
        voice_vendor: 'vapi',
      });
      voiceAnchorIdRef.current = startVoice(toCanonicalScreenId(metadata.screen));
      setStateSynced('listening');
      const t = tokenRef.current;
      if (t) setOwnerPhase(t, 'listening');
      try {
        onCallStart?.();
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
        const m = message as { type?: string; transcriptType?: string; transcript?: unknown };
        if (m?.type !== 'transcript' || m.transcriptType !== 'final') return;
        const text = m.transcript;
        if (typeof text === 'string') {
          transcriptCharsRef.current += text.length;
        }
      } catch {
        if (!transcriptWarnedRef.current) {
          transcriptWarnedRef.current = true;
          console.warn('[vapi] transcript message parse failed; transcript_length_chars=0');
        }
      }
    });

    client.on('error', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? 'Unknown Vapi error');
      fail(msg);
    });

    client.on('call-start-failed', (evt) => {
      fail(evt?.error ?? 'Vapi call-start failed.');
    });

    client.on('call-end', () => {
      if (tearingDownRef.current) return;
      stop();
    });

    try {
      await client.start(ASSISTANT_ID, {
        variableValues: {
          user_id: metadata.user_id,
          screen: metadata.screen ?? '',
          canonical_screen_id: toCanonicalScreenId(metadata.screen) ?? '',
          coaching_style: metadata.coaching_style ?? 'warm',
        },
      });
      // Teardown raced ahead of start()'s resolution. cleanup() already
      // issued stop() on the old client, but the Daily call may still be
      // settling — stop the stale instance again to avoid a leaked call.
      if (vapiRef.current !== client) {
        void client.stop().catch(() => {
          /* noop */
        });
      }
    } catch (err) {
      // If cleanup nulled vapiRef during await (user stop or unmount),
      // the throw is expected — don't surface a spurious error.
      if (!mountedRef.current || vapiRef.current !== client) return;
      fail(err instanceof Error ? err.message : 'Failed to start Vapi call.');
    }
  }, [
    acquireRealtime,
    cleanup,
    fail,
    metadata,
    onCallStart,
    onEnd,
    onError,
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
