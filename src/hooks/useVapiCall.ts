import Vapi from '@vapi-ai/web';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';

// VoiceContext contract mirror — see useRealtimeVoice.ts:132, 282-292, 388-415.

export type VapiCallStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export interface UseVapiCallReturn {
  status: VapiCallStatus;
  isMuted: boolean;
  isAssistantSpeaking: boolean;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
}

const PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string | undefined;

export function useVapiCall(): UseVapiCallReturn {
  const { enterRealtime, release, registerCleanup, transition } = useVoice();
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<VapiCallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ensureClient = useCallback(() => {
    if (!PUBLIC_KEY || !ASSISTANT_ID) {
      throw new Error(
        'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID in .env.local.',
      );
    }
    if (vapiRef.current) return vapiRef.current;

    const client = new Vapi(PUBLIC_KEY);

    client.on('call-start', () => {
      setStatus('active');
      setErrorMessage(null);
      transition('listening');
    });
    client.on('call-end', () => {
      setStatus('ended');
      setIsAssistantSpeaking(false);
      release();
    });
    client.on('speech-start', () => {
      setIsAssistantSpeaking(true);
      transition('speaking');
    });
    client.on('speech-end', () => {
      setIsAssistantSpeaking(false);
      transition('listening');
    });
    client.on('error', (err: unknown) => {
      setStatus('error');
      setIsAssistantSpeaking(false);
      const msg = err instanceof Error ? err.message : String(err ?? 'Unknown Vapi error');
      setErrorMessage(msg);
    });

    vapiRef.current = client;
    return client;
  }, [release, transition]);

  const stop = useCallback(() => {
    const client = vapiRef.current;
    if (!client) return;
    void client.stop();
    setStatus('ended');
    setIsAssistantSpeaking(false);
    release();
  }, [release]);

  const start = useCallback(async () => {
    let acquired = false;
    try {
      const client = ensureClient();
      if (!enterRealtime()) {
        setStatus('error');
        setErrorMessage('Could not acquire the voice channel.');
        return;
      }
      acquired = true;
      registerCleanup(stop);
      setStatus('connecting');
      setErrorMessage(null);
      await client.start(ASSISTANT_ID);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start Vapi call');
      if (acquired) stop();
      setStatus('error');
    }
  }, [enterRealtime, ensureClient, registerCleanup, stop]);

  const toggleMute = useCallback(() => {
    const client = vapiRef.current;
    if (!client) return;
    const next = !isMuted;
    client.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      const client = vapiRef.current;
      if (!client) return;
      client.removeAllListeners();
      void client.stop();
      vapiRef.current = null;
    };
  }, []);

  return {
    status,
    isMuted,
    isAssistantSpeaking,
    errorMessage,
    start,
    stop,
    toggleMute,
  };
}
