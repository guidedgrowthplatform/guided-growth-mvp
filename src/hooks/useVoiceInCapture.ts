import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics/posthog';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import {
  startSonioxBrowserSession,
  type BrowserSttHandle,
  type SonioxFinalMeta,
  type SonioxState,
} from '@/lib/services/soniox-stream';

export type VapiStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error' | null | undefined;

// Bound auto-restart so a hard-down link can't hot-loop the mic boot.
const MAX_AUTO_RESTARTS = 3;
const AUTO_RESTART_WINDOW_MS = 60000;

// A denied/missing mic is permanent — restarting just re-prompts forever.
// Everything else (WS drop, watchdog timeout, dead capture) is transient.
export function isRecoverableVoiceError(msg: string): boolean {
  const m = msg.toLowerCase();
  if (
    m.includes('permission') ||
    m.includes('notallowed') ||
    m.includes('not allowed') ||
    m.includes('denied') ||
    m.includes('notfound') ||
    m.includes('not found') ||
    m.includes('no device') ||
    m.includes('requested device')
  ) {
    return false;
  }
  return true;
}

// Vapi-released gate. Local mic must not contend with WebRTC track.
export function shouldStartVoiceIn(active: boolean, vapiStatus: VapiStatus): boolean {
  if (!active) return false;
  return vapiStatus !== 'active' && vapiStatus !== 'connecting';
}

interface Options {
  active: boolean;
  vapiStatus: VapiStatus;
  onTranscript: (text: string, meta?: SonioxFinalMeta) => void;
  onInterim?: (text: string) => void;
  responding?: boolean;
  onError?: (msg: string) => void;
}

export function useVoiceInCapture({
  active,
  vapiStatus,
  onTranscript,
  onInterim,
  responding,
  onError,
}: Options): {
  isListening: boolean;
} {
  const [isListening, setIsListening] = useState(false);
  // Bumping this re-runs the session effect to boot a fresh mic after a transient drop.
  const [restartNonce, setRestartNonce] = useState(0);
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  const respondingRef = useRef(responding);
  const sessionRef = useRef<BrowserSttHandle | null>(null);
  const restartStampsRef = useRef<number[]>([]);
  // Suppress the misleading "can't hear you" bubble once we've already transcribed speech this session.
  const heardAnyFinalRef = useRef(false);
  // Set when an offline drop parks a dead-but-not-torn-down handle.
  const parkedOfflineRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    onInterimRef.current = onInterim;
  }, [onInterim]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    respondingRef.current = responding;
  }, [responding]);

  // Forward responding into the live session without restarting the socket.
  useEffect(() => {
    sessionRef.current?.setResponding(responding === true);
  }, [responding]);

  // A real start/stop (not an auto-restart) gets a fresh restart budget.
  useEffect(() => {
    restartStampsRef.current = [];
    heardAnyFinalRef.current = false;
    parkedOfflineRef.current = false;
  }, [active, vapiStatus]);

  // Connectivity restored: reboot a parked session, never a healthy live one.
  useEffect(() => {
    const handleOnline = () => {
      if (!shouldStartVoiceIn(active, vapiStatus)) return;
      if (!parkedOfflineRef.current && sessionRef.current) return;
      parkedOfflineRef.current = false;
      restartStampsRef.current = [];
      setRestartNonce((n) => n + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [active, vapiStatus]);

  useEffect(() => {
    if (!VOICE_IN_ENABLED) return;
    if (!shouldStartVoiceIn(active, vapiStatus)) return;

    let disposed = false;
    const handle = startSonioxBrowserSession({
      onInterim: (t) => {
        if (!disposed) onInterimRef.current?.(t);
      },
      onFinal: (t, meta) => {
        // forward post-teardown — stop()'s finalize must still deliver the turn
        const trimmed = t.trim();
        if (trimmed) {
          heardAnyFinalRef.current = true;
          onTranscriptRef.current(trimmed, meta);
        }
      },
      onStateChange: (s: SonioxState) => {
        if (disposed) return;
        if (s === 'listening') parkedOfflineRef.current = false;
        setIsListening(s === 'listening');
      },
      onConnected: (m) => track('stt_connect_ms', { ...m }),
      onError: (msg) => {
        if (disposed) return;
        setIsListening(false);
        // Vapi may have taken over since boot — never restart into a live WebRTC track.
        if (isRecoverableVoiceError(msg) && shouldStartVoiceIn(active, vapiStatus)) {
          // Offline: don't spend budget or reboot here — the 'online' listener drives recovery.
          if (navigator.onLine === false) {
            parkedOfflineRef.current = true;
            if (heardAnyFinalRef.current) {
              track('voice_in_recoverable_error_swallowed', { msg });
              return;
            }
            onErrorRef.current?.(msg);
            return;
          }
          const now = Date.now();
          const recent = restartStampsRef.current.filter((t) => now - t < AUTO_RESTART_WINDOW_MS);
          if (recent.length < MAX_AUTO_RESTARTS) {
            recent.push(now);
            restartStampsRef.current = recent;
            setRestartNonce((n) => n + 1);
            return;
          }
          // Budget spent on a transient error AFTER we already heard speech: don't accuse the user
          // of being unhearable. Recovery still ran; only the misleading bubble is swallowed.
          if (heardAnyFinalRef.current) {
            track('voice_in_recoverable_error_swallowed', { msg });
            return;
          }
        }
        onErrorRef.current?.(msg);
      },
    });
    sessionRef.current = handle;
    if (respondingRef.current === true) handle.setResponding(true);

    return () => {
      disposed = true;
      sessionRef.current = null;
      handle.stop();
      setIsListening(false);
    };
  }, [active, vapiStatus, restartNonce]);

  return { isListening };
}
