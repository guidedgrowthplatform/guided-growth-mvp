import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics/posthog';
import { VOICE_IN_ENABLED } from '@/lib/config/voice';
import {
  startSonioxBrowserSession,
  type BrowserSttHandle,
  type SonioxState,
} from '@/lib/services/soniox-stream';

export type VapiStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error' | null | undefined;

// Vapi-released gate. Local mic must not contend with WebRTC track.
export function shouldStartVoiceIn(active: boolean, vapiStatus: VapiStatus): boolean {
  if (!active) return false;
  return vapiStatus !== 'active' && vapiStatus !== 'connecting';
}

interface Options {
  active: boolean;
  vapiStatus: VapiStatus;
  onTranscript: (text: string) => void;
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
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  const respondingRef = useRef(responding);
  const sessionRef = useRef<BrowserSttHandle | null>(null);

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

  useEffect(() => {
    if (!VOICE_IN_ENABLED) return;
    if (!shouldStartVoiceIn(active, vapiStatus)) return;

    let disposed = false;
    const handle = startSonioxBrowserSession({
      onInterim: (t) => {
        if (!disposed) onInterimRef.current?.(t);
      },
      onFinal: (t) => {
        // forward post-teardown — stop()'s finalize must still deliver the turn
        const trimmed = t.trim();
        if (trimmed) onTranscriptRef.current(trimmed);
      },
      onStateChange: (s: SonioxState) => {
        if (!disposed) setIsListening(s === 'listening');
      },
      onConnected: (m) => track('stt_connect_ms', { ...m }),
      onError: (msg) => {
        if (disposed) return;
        setIsListening(false);
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
  }, [active, vapiStatus]);

  return { isListening };
}
