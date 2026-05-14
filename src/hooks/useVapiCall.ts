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
  isTtsMuted: boolean;
  isAssistantSpeaking: boolean;
  errorMessage: string | null;
  start: (screenId: string) => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
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
  // Anchors the next state_delta to events since this screen change, instead
  // of since call-start. Without it, the LLM keeps seeing prior screens'
  // navigate / voice events for the rest of the call and re-anchors to them.
  const lastScreenChangeTsRef = useRef<string | null>(null);
  const [status, setStatus] = useState<VapiCallStatus>('idle');
  // Mic starts muted (Vapi constructed with startAudioOff: true) so the
  // assistant can speak before the user has explicitly granted/enabled mic
  // input on the mic-permission screen.
  const [isMuted, setIsMuted] = useState(true);
  const [isTtsMuted, setIsTtsMuted] = useState(false);
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
        // triggerResponseEnabled: true makes the LLM speak based on the new
        // screen context. Without it, Vapi silently appends the system message
        // and waits for a user turn — which never arrives because the mic is
        // muted until MIC-PERMISSION, so the call appears frozen on every
        // screen.
        client.send({
          type: 'add-message',
          message: { role: 'system', content: body },
          triggerResponseEnabled: true,
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

    // `startAudioOff: true` mutes the local mic at call-start so the assistant
    // can talk on screens like VOICE-PREFERENCE before the user reaches
    // MIC-PERMISSION and explicitly enables input.
    const client = new Vapi(PUBLIC_KEY, undefined, undefined, { startAudioOff: true });

    client.on('call-start', () => {
      setStatus('active');
      setErrorMessage(null);
      const nowIso = new Date().toISOString();
      callStartTsRef.current = nowIso;
      lastScreenChangeTsRef.current = nowIso;
      const screenId = pendingScreenIdRef.current;
      pendingScreenIdRef.current = null;
      if (screenId) void sendContext(screenId, null);
    });
    client.on('call-end', () => {
      setStatus('ended');
      setIsAssistantSpeaking(false);
      // Reset to constructor-time defaults so a subsequent restart() begins
      // in the same "mic off, TTS on" posture as a fresh call.
      setIsMuted(true);
      setIsTtsMuted(false);
      callStartTsRef.current = null;
      lastScreenChangeTsRef.current = null;
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
    lastScreenChangeTsRef.current = null;
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
      // Snapshot the prior screen-change ts, advance the cursor immediately so
      // a rapid second navigation doesn't re-replay the same delta window.
      const sinceTs = lastScreenChangeTsRef.current ?? callStartTsRef.current;
      lastScreenChangeTsRef.current = new Date().toISOString();
      await sendContext(screenId, sinceTs);
    },
    [sendContext],
  );

  const setMicEnabled = useCallback((enabled: boolean) => {
    const client = vapiRef.current;
    if (!client) return;
    const nextMuted = !enabled;
    client.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, []);

  const setTtsEnabled = useCallback((enabled: boolean) => {
    const client = vapiRef.current;
    if (!client) return;
    client.send({
      type: 'control',
      control: enabled ? 'unmute-assistant' : 'mute-assistant',
    });
    setIsTtsMuted(!enabled);
  }, []);

  const toggleMute = useCallback(() => {
    setMicEnabled(isMuted);
  }, [isMuted, setMicEnabled]);

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
    isTtsMuted,
    isAssistantSpeaking,
    errorMessage,
    start,
    stop,
    toggleMute,
    setMicEnabled,
    setTtsEnabled,
    refreshContext,
  };
}
