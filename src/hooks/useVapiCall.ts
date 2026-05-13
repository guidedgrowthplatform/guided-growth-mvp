import { useQueryClient } from '@tanstack/react-query';
import Vapi from '@vapi-ai/web';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { buildContextMessage } from '@/lib/context/buildContextMessage';
import { getScreenContext } from '@/lib/context/getScreenContext';

export const VAPI_ENV_MISSING_ERROR =
  'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID in .env.local.';

export type VapiCallStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export interface UseVapiCallReturn {
  status: VapiCallStatus;
  isMuted: boolean;
  isAssistantSpeaking: boolean;
  errorMessage: string | null;
  start: (screenId: string) => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
  refreshContext: (screenId: string) => Promise<void>;
}

const PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string | undefined;

export function useVapiCall(): UseVapiCallReturn {
  const qc = useQueryClient();
  const { enterRealtime, release, registerCleanup, transition } = useVoice();
  const vapiRef = useRef<Vapi | null>(null);
  const pendingScreenIdRef = useRef<string | null>(null);
  const callStartTsRef = useRef<string | null>(null);
  const [status, setStatus] = useState<VapiCallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendContext = useCallback(
    async (screenId: string, sinceTs: string | null) => {
      const client = vapiRef.current;
      if (!client) return;
      try {
        const ctx = await getScreenContext(qc, screenId, sinceTs);
        const body = buildContextMessage({
          screen_id: ctx.screen_id,
          context_block: ctx.context_block,
          state_delta: ctx.state_delta,
        });
        client.send({
          type: 'add-message',
          message: { role: 'system', content: body },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch screen context';
        setErrorMessage(`Context push failed: ${msg}`);
      }
    },
    [qc],
  );

  const ensureClient = useCallback(() => {
    if (!PUBLIC_KEY || !ASSISTANT_ID) {
      throw new Error(VAPI_ENV_MISSING_ERROR);
    }
    if (vapiRef.current) return vapiRef.current;

    const client = new Vapi(PUBLIC_KEY);

    client.on('call-start', () => {
      setStatus('active');
      setErrorMessage(null);
      callStartTsRef.current = new Date().toISOString();
      const screenId = pendingScreenIdRef.current;
      pendingScreenIdRef.current = null;
      if (screenId) void sendContext(screenId, null);
    });
    client.on('call-end', () => {
      setStatus('ended');
      setIsAssistantSpeaking(false);
      callStartTsRef.current = null;
      pendingScreenIdRef.current = null;
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
      setIsAssistantSpeaking(false);
      const msg = err instanceof Error ? err.message : String(err ?? 'Unknown Vapi error');
      setErrorMessage(msg);
      setStatus('error');
      release();
    });

    vapiRef.current = client;
    return client;
  }, [release, transition, sendContext]);

  const stop = useCallback(() => {
    const client = vapiRef.current;
    if (!client) return;
    void client.stop();
    setStatus('ended');
    setIsAssistantSpeaking(false);
    callStartTsRef.current = null;
    pendingScreenIdRef.current = null;
    release();
  }, [release]);

  const start = useCallback(
    async (screenId: string) => {
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
        pendingScreenIdRef.current = screenId;
        setStatus('connecting');
        setErrorMessage(null);
        await client.start(ASSISTANT_ID);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to start Vapi call');
        if (acquired) stop();
        setStatus('error');
      }
    },
    [enterRealtime, ensureClient, registerCleanup, stop],
  );

  const refreshContext = useCallback(
    async (screenId: string) => {
      if (!vapiRef.current || !callStartTsRef.current) return;
      await sendContext(screenId, callStartTsRef.current);
    },
    [sendContext],
  );

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
      release();
    };
  }, [release]);

  return {
    status,
    isMuted,
    isAssistantSpeaking,
    errorMessage,
    start,
    stop,
    toggleMute,
    refreshContext,
  };
}
