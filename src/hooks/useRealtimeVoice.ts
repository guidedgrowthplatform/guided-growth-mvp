import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { buildSystemPrompt } from '@/lib/coaching/systemPrompt';
import type { UserContext } from '@/lib/coaching/systemPrompt';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RealtimeVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

interface UseRealtimeVoiceOptions {
  /** User context for the system prompt */
  userContext: UserContext;
  /** Called when the AI produces a text transcript of its response */
  onTranscript?: (text: string) => void;
  /** Called when the user's speech is transcribed */
  onUserSpeech?: (text: string) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Called when the conversation ends */
  onEnd?: () => void;
}

interface UseRealtimeVoiceReturn {
  /** Start a realtime voice conversation */
  start: () => Promise<void>;
  /** Stop the conversation */
  stop: () => void;
  /** Current state */
  state: RealtimeVoiceState;
  /** Whether currently in a conversation */
  isActive: boolean;
  /** Last transcript from the AI */
  aiTranscript: string;
  /** Last transcript from the user */
  userTranscript: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook for real-time voice conversations with the Cartesia Line agent.
 *
 * Architecture (from newdocs.txt Section 3):
 * - Browser streams mic audio → WebSocket → Line agent
 * - Line agent runs STT (Ink) → LLM (GPT-4o-mini) → TTS (Sonic) → audio back
 * - Browser plays response audio in real-time
 *
 * Current status: PLACEHOLDER — requires Cartesia Startup tier for Line agents.
 * The hook interface is ready; the WebSocket connection will be implemented
 * once the Line agent is deployed with `cartesia deploy`.
 *
 * When the Line agent is live, replace the TODO sections with:
 *   import { CartesiaClient } from "@cartesia/cartesia-js";
 *   const client = new CartesiaClient({ apiKey: "..." });
 *   const conversation = client.voice.conversation({ agentId: "..." });
 */
export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const {
    userContext,
    onTranscript: _onTranscript,
    onUserSpeech: _onUserSpeech,
    onError,
    onEnd,
  } = options;
  const { enterRealtime, release, registerCleanup, preference } = useVoice();

  const [state, setState] = useState<RealtimeVoiceState>('idle');
  const [aiTranscript] = useState('');
  const [userTranscript] = useState('');

  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  // TODO: Replace with CartesiaClient conversation reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectionRef = useRef<any>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Close WebSocket / conversation
    if (connectionRef.current) {
      try {
        connectionRef.current.close?.();
      } catch {
        /* ignore */
      }
      connectionRef.current = null;
    }
    if (mountedRef.current) {
      setState('idle');
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    release();
    onEnd?.();
  }, [cleanup, release, onEnd]);

  const start = useCallback(async () => {
    // Respect voice preference
    if (preference === 'text_only') {
      onError?.('Voice is disabled. Change your preference in Settings.');
      return;
    }

    // Request realtime mode (stops MP3 if playing)
    const ok = enterRealtime();
    if (!ok) {
      onError?.('Could not start voice session.');
      return;
    }

    // Register cleanup so VoiceContext can stop us
    registerCleanup(stop);

    setState('connecting');

    try {
      // Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Build the system prompt for this conversation
      const _systemPrompt = buildSystemPrompt(userContext);

      // ──────────────────────────────────────────────────────────
      // TODO: Connect to Cartesia Line agent via WebSocket
      //
      // When Line agent is deployed:
      //
      // const client = new CartesiaClient({ apiKey: CARTESIA_API_KEY });
      // const conversation = client.voice.conversation({
      //   agentId: AGENT_ID,
      //   onMessage: (msg) => {
      //     if (msg.type === 'transcript') {
      //       setAiTranscript(msg.text);
      //       onTranscript?.(msg.text);
      //     }
      //     if (msg.type === 'user_transcript') {
      //       setUserTranscript(msg.text);
      //       onUserSpeech?.(msg.text);
      //     }
      //   },
      //   onError: (err) => {
      //     setState('error');
      //     onError?.(err.message);
      //   },
      //   onEnd: () => {
      //     stop();
      //   },
      // });
      // connectionRef.current = conversation;
      // await conversation.start(stream);
      // ──────────────────────────────────────────────────────────

      // PLACEHOLDER: Simulate connected state
      if (mountedRef.current) {
        setState('listening');
        console.log('[RealtimeVoice] Placeholder mode — Line agent not connected yet');
        console.log('[RealtimeVoice] System prompt length:', _systemPrompt.length, 'chars');
      }
    } catch (err) {
      cleanup();
      release();
      if (mountedRef.current) {
        setState('error');
      }
      const msg = err instanceof Error ? err.message : 'Failed to start voice session';
      onError?.(msg);
    }
  }, [preference, enterRealtime, registerCleanup, stop, userContext, onError, release, cleanup]);

  return {
    start,
    stop,
    state,
    isActive: state !== 'idle' && state !== 'error',
    aiTranscript,
    userTranscript,
  };
}
