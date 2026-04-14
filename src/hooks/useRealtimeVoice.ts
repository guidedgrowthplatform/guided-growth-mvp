import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import type { UserContext } from '@/lib/coaching/systemPrompt';
import { injectUserContext } from '@/lib/services/agent-context';
import { supabase } from '@/lib/supabase';

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

// ─── Helpers ───────────────────────────────────────────────────────────────

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  }
  return '';
}

/** Fetch a short-lived Cartesia access token from our backend. */
async function fetchAgentToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${getApiBase()}/api/cartesia-token`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `Token request failed (${res.status})`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

// ─── Audio Helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Float32Array of PCM samples to 16-bit PCM and return as ArrayBuffer.
 * The agent expects 16-bit PCM at 16 kHz mono.
 */
function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Play raw PCM 16-bit audio received from the agent.
 * Returns an AudioBufferSourceNode that can be stopped.
 */
function playPcm16Audio(
  audioCtx: AudioContext,
  pcmData: ArrayBuffer,
  sampleRate: number,
): AudioBufferSourceNode {
  const int16 = new Int16Array(pcmData);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }

  const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start();
  return source;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook for real-time voice conversations with the Cartesia Line agent.
 *
 * Architecture (from docs Section 3):
 * - Browser streams mic audio → WebSocket → Cartesia Line agent
 * - Line agent runs STT (Ink) → LLM (GPT-4o-mini) → TTS (Sonic) → audio back
 * - Browser plays response audio in real-time
 *
 * Security: API key never touches the browser. We fetch a short-lived access
 * token from /api/cartesia-token (which uses the server-side key).
 */
export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const {
    userContext: _userContext,
    onTranscript: onTranscriptCb,
    onUserSpeech: onUserSpeechCb,
    onError,
    onEnd,
  } = options;
  const { enterRealtime, release, registerCleanup, preference, transition } = useVoice();

  const [state, setState] = useState<RealtimeVoiceState>('idle');
  const [aiTranscript, setAiTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');

  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const playTimerRef = useRef<number | null>(null);

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
    // Disconnect audio processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    // Close AudioContext
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'cleanup');
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (mountedRef.current) {
      setState('idle');
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    try {
      release();
    } catch {
      /* ignore */
    }
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
      // 1. Request mic access. Leave DSP filters OFF — Windows Chrome
      // aggressively mutes quiet audio with noiseSuppression+AGC on,
      // which can silently suppress real user speech. Cartesia Ink STT
      // handles noisy input fine on its own.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      console.log('[Cartesia WS] mic stream acquired', {
        tracks: stream.getAudioTracks().map((t) => t.getSettings()),
      });

      // 2. Inject user context into agent prompt (name, habits, streaks).
      // Fire-and-forget — doesn't gate WebSocket connection. Worst case the
      // first turn lacks personalized context; subsequent turns pick it up.
      void injectUserContext().catch(() => {});

      // 3. Fetch short-lived access token from backend
      const token = await fetchAgentToken();

      // 3. Build WebSocket URL
      const agentId = (import.meta.env.VITE_CARTESIA_AGENT_ID || '').trim();
      if (!agentId) {
        throw new Error('VITE_CARTESIA_AGENT_ID not configured. Deploy the Line agent first.');
      }

      // 4. Connect to Cartesia agent stream (docs: /agents/stream/{agent_id})
      const wsUrl = `wss://api.cartesia.ai/agents/stream/${agentId}?api_key=${token}&cartesia_version=2025-04-16`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // 5. AudioContext at 16kHz — matches both Cartesia agent input and output.
      // Avoids resampling drift in mic capture (processor reads at ctx rate,
      // sends as pcm_16000; if ctx != 16k, agent receives wrong-rate audio).
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      audioCtxRef.current = audioCtx;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timed out'));
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          // Send start event (required first message per docs)
          ws.send(
            JSON.stringify({
              event: 'start',
              config: { input_format: 'pcm_16000' },
            }),
          );
          resolve();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });

      // 6. Handle incoming messages
      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        if (event.data instanceof ArrayBuffer) {
          // Binary = audio data from agent (PCM 16-bit, 16kHz mono)
          if (audioCtxRef.current) {
            playPcm16Audio(audioCtxRef.current, event.data, 16000);
          }
          if (state !== 'speaking') {
            setState('speaking');
            transition('speaking');
          }
          return;
        }

        // Text = JSON messages (control + audio)
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const eventType = (msg.event as string) || (msg.type as string) || '';

          // Debug trace (safe: no payload logged for media_output).
          if (eventType !== 'media_output') {
            console.log('[Cartesia WS]', eventType, msg);
          }

          // Agent audio output — stream each chunk with gapless scheduling.
          // Cartesia agent output verified at PCM 16-bit 16kHz mono (Ink/Sonic
          // default for agents). Browser resamples to AudioContext rate.
          if (eventType === 'media_output' && msg.media) {
            const media = msg.media as { payload?: string };
            if (media.payload && audioCtxRef.current) {
              const ctx = audioCtxRef.current;
              const binary = atob(media.payload);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

              // PCM 16-bit LE → Float32
              const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
              const float32 = new Float32Array(int16.length);
              for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

              // Build buffer at source rate (16kHz); browser resamples to ctx rate.
              const buf = ctx.createBuffer(1, float32.length, 16000);
              buf.getChannelData(0).set(float32);
              const src = ctx.createBufferSource();
              src.buffer = buf;
              src.connect(ctx.destination);

              // Gapless scheduling — queue chunks back-to-back
              const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
              src.start(startAt);
              nextPlayTimeRef.current = startAt + buf.duration;

              if (state !== 'speaking') {
                setState('speaking');
                transition('speaking');
              }

              // When the last queued chunk ends, transition back to listening
              if (playTimerRef.current) clearTimeout(playTimerRef.current);
              const msUntilEnd = (nextPlayTimeRef.current - ctx.currentTime) * 1000 + 100;
              playTimerRef.current = window.setTimeout(() => {
                if (mountedRef.current) {
                  setState('listening');
                  transition('listening');
                }
              }, msUntilEnd);
            }
            return;
          }

          // Agent transcript (what AI said as text)
          if (eventType === 'agent_transcript' || eventType === 'agent_text_sent') {
            const text = (msg.text || msg.transcript || '') as string;
            if (text) {
              setState('speaking');
              setAiTranscript(text);
              onTranscriptCb?.(text);
            }
          }

          // User transcript (what user said)
          if (eventType === 'user_transcript' || eventType === 'user_text_sent') {
            const text = (msg.text || msg.transcript || '') as string;
            if (text) {
              setState('listening');
              setUserTranscript(text);
              onUserSpeechCb?.(text);
            }
          }

          // Ack (connection confirmed)
          if (eventType === 'ack') {
            setState('listening');
          }

          // Error
          if (eventType === 'error') {
            onError?.((msg.message || msg.text || 'Agent error') as string);
          }
        } catch {
          // Non-JSON — ignore
        }
      };

      ws.onclose = () => {
        if (mountedRef.current && state !== 'idle') {
          stop();
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) {
          setState('error');
          transition('idle');
          onError?.('Voice connection lost');
        }
      };

      // 7. Stream mic audio to agent
      const source = audioCtx.createMediaStreamSource(stream);
      // ScriptProcessorNode is deprecated but widely supported.
      // For production, migrate to AudioWorklet.
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let frameCount = 0;
      let lastLogT = performance.now();
      let maxAmp = 0;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Track peak amplitude to detect silent mic
        for (let i = 0; i < inputData.length; i++) {
          const a = Math.abs(inputData[i]);
          if (a > maxAmp) maxAmp = a;
        }
        const pcm16 = float32ToPcm16(inputData);
        ws.send(pcm16);
        frameCount++;
        const now = performance.now();
        if (now - lastLogT > 3000) {
          console.log(
            `[Cartesia WS] sent ${frameCount} PCM frames in last ${Math.round((now - lastLogT) / 1000)}s, peak amp=${maxAmp.toFixed(3)} ${maxAmp < 0.01 ? '(MIC SILENT?)' : ''}`,
          );
          frameCount = 0;
          maxAmp = 0;
          lastLogT = now;
        }
      };

      source.connect(processor);
      // ScriptProcessor must be connected somewhere to fire onaudioprocess,
      // but routing to audioCtx.destination plays mic audio out the speaker
      // (echo loop). Route through a muted GainNode instead.
      const muteSink = audioCtx.createGain();
      muteSink.gain.value = 0;
      processor.connect(muteSink);
      muteSink.connect(audioCtx.destination);

      if (mountedRef.current) {
        setState('listening');
        transition('listening');
      }
    } catch (err) {
      cleanup();
      release();
      if (mountedRef.current) {
        setState('error');
        transition('idle');
      }
      const msg = err instanceof Error ? err.message : 'Failed to start voice session';
      onError?.(msg);
    }
  }, [
    preference,
    enterRealtime,
    registerCleanup,
    stop,
    onError,
    onTranscriptCb,
    onUserSpeechCb,
    release,
    cleanup,
    transition,
    state,
  ]);

  return {
    start,
    stop,
    state,
    isActive: state !== 'idle' && state !== 'error',
    aiTranscript,
    userTranscript,
  };
}
