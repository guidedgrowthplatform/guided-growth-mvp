import Vapi from '@vapi-ai/web';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReleaseToken } from '@/contexts/voiceContextDef';
import { useVoice } from '@/hooks/useVoice';

export const VAPI_ENV_MISSING_ERROR =
  'Vapi env vars missing. Set VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID in .env.local.';

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
  const { acquireRealtime, releaseToken, setStatus: setOwnerPhase } = useVoice();
  const vapiRef = useRef<Vapi | null>(null);
  const tokenRef = useRef<ReleaseToken | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<VapiCallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dropToken = useCallback(() => {
    const t = tokenRef.current;
    if (!t) return;
    tokenRef.current = null;
    releaseToken(t);
  }, [releaseToken]);

  const ensureClient = useCallback(() => {
    if (!PUBLIC_KEY || !ASSISTANT_ID) {
      throw new Error(VAPI_ENV_MISSING_ERROR);
    }
    if (vapiRef.current) return vapiRef.current;

    const client = new Vapi(PUBLIC_KEY);

    client.on('call-start', () => {
      if (!mountedRef.current) return;
      setStatus('active');
      setErrorMessage(null);
    });
    client.on('call-end', () => {
      if (mountedRef.current) {
        setStatus('ended');
        setIsAssistantSpeaking(false);
      }
      dropToken();
    });
    client.on('speech-start', () => {
      if (mountedRef.current) setIsAssistantSpeaking(true);
      const t = tokenRef.current;
      if (t) setOwnerPhase(t, 'speaking');
    });
    client.on('speech-end', () => {
      if (mountedRef.current) setIsAssistantSpeaking(false);
      const t = tokenRef.current;
      if (t) setOwnerPhase(t, 'listening');
    });
    client.on('error', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? 'Unknown Vapi error');
      if (mountedRef.current) {
        setIsAssistantSpeaking(false);
        setErrorMessage(msg);
        setStatus('error');
      }
      dropToken();
    });

    vapiRef.current = client;
    return client;
  }, [dropToken, setOwnerPhase]);

  const stop = useCallback(() => {
    const client = vapiRef.current;
    if (!client) return;
    void client.stop();
    if (mountedRef.current) {
      setStatus('ended');
      setIsAssistantSpeaking(false);
    }
    dropToken();
  }, [dropToken]);

  const start = useCallback(async () => {
    let acquiredToken: ReleaseToken | null = null;
    try {
      const client = ensureClient();
      const token = acquireRealtime({
        surface: 'onboarding',
        onCleanup: () => {
          const c = vapiRef.current;
          if (c) void c.stop();
          tokenRef.current = null;
          if (mountedRef.current) {
            setStatus('ended');
            setIsAssistantSpeaking(false);
          }
        },
      });
      if (!token) {
        setStatus('error');
        setErrorMessage('Could not acquire the voice channel.');
        return;
      }
      acquiredToken = token;
      tokenRef.current = token;
      setStatus('connecting');
      setErrorMessage(null);
      await client.start(ASSISTANT_ID);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start Vapi call');
      if (acquiredToken) {
        tokenRef.current = null;
        releaseToken(acquiredToken);
      }
      setStatus('error');
    }
  }, [acquireRealtime, releaseToken, ensureClient]);

  const toggleMute = useCallback(() => {
    const client = vapiRef.current;
    if (!client) return;
    const next = !isMuted;
    client.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const client = vapiRef.current;
      if (client) {
        client.removeAllListeners();
        void client.stop();
        vapiRef.current = null;
      }
      dropToken();
    };
  }, [dropToken]);

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
