import { useEffect, useRef, useState } from 'react';
import { startRecording, stopAndTranscribe, stopRecording } from '@/lib/services/stt-service';

export type VapiStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error' | null | undefined;

const STATE3_ENABLED = false;

// Vapi-released gate. Local mic must not contend with WebRTC track.
export function shouldStartState3(active: boolean, vapiStatus: VapiStatus): boolean {
  if (!active) return false;
  return vapiStatus !== 'active' && vapiStatus !== 'connecting';
}

interface LoopDeps {
  startRecording: typeof startRecording;
  stopAndTranscribe: typeof stopAndTranscribe;
  stopRecording: typeof stopRecording;
  setListening: (v: boolean) => void;
  isCancelled: () => boolean;
  isStillActive: () => boolean;
  signal: AbortSignal;
  onTranscript: (text: string) => void;
}

export async function runState3Loop(deps: LoopDeps): Promise<void> {
  if (deps.isCancelled() || !deps.isStillActive() || deps.signal.aborted) return;
  try {
    await deps.startRecording({
      onError: () => deps.setListening(false),
      onOpen: () => {
        if (!deps.isCancelled() && !deps.signal.aborted) deps.setListening(true);
      },
    });
  } catch (err) {
    console.warn('[useState3VoiceInput] startRecording failed', err);
    deps.setListening(false);
    return;
  }
  let text = '';
  try {
    text = await deps.stopAndTranscribe(deps.signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.warn('[useState3VoiceInput] transcribe error', err);
  }
  deps.setListening(false);
  if (deps.isCancelled() || deps.signal.aborted || !deps.isStillActive()) return;
  if (text && text.trim()) deps.onTranscript(text.trim());
}

interface Options {
  active: boolean;
  vapiStatus: VapiStatus;
  onTranscript: (text: string) => void;
}

export function useState3VoiceInput({ active, vapiStatus, onTranscript }: Options): {
  isListeningLocal: boolean;
} {
  const [isListeningLocal, setIsListeningLocal] = useState(false);
  const activeRef = useRef(active);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (!STATE3_ENABLED) return;
    if (!shouldStartState3(active, vapiStatus)) return;

    const abort = new AbortController();
    let cancelled = false;

    void runState3Loop({
      startRecording,
      stopAndTranscribe,
      stopRecording,
      setListening: setIsListeningLocal,
      isCancelled: () => cancelled,
      isStillActive: () => activeRef.current,
      signal: abort.signal,
      onTranscript: (t) => onTranscriptRef.current(t),
    });

    return () => {
      cancelled = true;
      abort.abort();
      try {
        stopRecording();
      } catch {
        /* ignore */
      }
      setIsListeningLocal(false);
    };
  }, [active, vapiStatus]);

  return { isListeningLocal };
}
