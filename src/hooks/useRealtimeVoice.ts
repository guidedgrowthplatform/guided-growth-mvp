import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import {
  CartesiaAgentClient,
  type AgentStartMetadata,
  type AudioFormat,
} from '@/lib/services/cartesia-agent';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RealtimeVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

interface UseRealtimeVoiceOptions {
  /** Metadata forwarded to the agent in the start event. */
  metadata: AgentStartMetadata;
  /** Called when the session closes, by user stop or server close. */
  onEnd?: () => void;
  /** Called on any protocol / mic / token error. */
  onError?: (message: string) => void;
}

interface UseRealtimeVoiceReturn {
  start: () => Promise<void>;
  stop: () => void;
  state: RealtimeVoiceState;
  isActive: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const INPUT_FORMAT: AudioFormat = 'pcm_16000';
const OUTPUT_FORMAT: AudioFormat = 'pcm_44100';
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 44100;
const CAPTURE_BUFFER_SIZE = 4096;
const TOKEN_ENDPOINT = '/api/cartesia-agent-token';

// ─── Audio helpers ──────────────────────────────────────────────────────────

/** Convert Float32 samples [-1, 1] → 16-bit little-endian PCM bytes. */
function float32ToPcm16LE(samples: Float32Array): Uint8Array {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/**
 * Naive linear downsample. Acceptable for 16-bit speech given a browser-side
 * antialiasing implicit in the native AudioContext resampler. If quality
 * issues surface, swap for a proper polyphase filter.
 */
function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = samples[Math.floor(i * ratio)];
  }
  return out;
}

/** Decode a 16-bit little-endian PCM chunk into a Float32 AudioBuffer. */
function pcm16LEToAudioBuffer(ctx: AudioContext, pcm: Uint8Array, sampleRate: number): AudioBuffer {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const frameCount = Math.floor(pcm.byteLength / 2);
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    channel[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
  }
  return buffer;
}

// ─── Token fetch ────────────────────────────────────────────────────────────

async function fetchAccessToken(signal: AbortSignal): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`token endpoint returned ${res.status}`);
  }
  const data: unknown = await res.json();
  const token = (data as { token?: unknown } | null)?.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('token endpoint returned unexpected shape');
  }
  return token;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Connect the browser to a deployed Cartesia Line agent for a real-time
 * voice coaching session.
 *
 * Caller contract:
 *   - Button tap → `start()` → hook acquires mic, mints a token, opens the
 *     WebSocket, and streams mic audio while playing agent audio back.
 *   - Any Supabase-visible side effects (form auto-fill, navigation) must
 *     be observed via Supabase Realtime elsewhere — the WebSocket carries
 *     audio only. See `src/lib/services/cartesia-agent.ts` for the wire
 *     protocol details.
 *   - `stop()` or unmount tears everything down in ~100ms.
 *
 * This hook is currently un-consumed (wiring to ONBOARD-01 is the next
 * MR). It is shipped orphaned so the transport layer and the mic pipeline
 * can be reviewed independently of the UI integration.
 */
export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const { metadata, onEnd, onError } = options;
  const { enterRealtime, release, registerCleanup, preference, transition } = useVoice();

  const [state, setState] = useState<RealtimeVoiceState>('idle');

  // Lifecycle-spanning refs
  const mountedRef = useRef(true);
  const clientRef = useRef<CartesiaAgentClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mutedRef = useRef<GainNode | null>(null);
  const playbackCursorRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  // Mirror of `state` for reads inside long-lived callbacks (onAudio) that
  // would otherwise capture a stale closure from the render where the
  // callback was created.
  const stateRef = useRef<RealtimeVoiceState>('idle');
  // Re-entrancy guard: true while cleanup() is tearing resources down. Any
  // async start() in flight must not create new resources while this is set.
  const tearingDownRef = useRef(false);

  const setStateSynced = useCallback((next: RealtimeVoiceState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    tearingDownRef.current = true;

    abortRef.current?.abort();
    abortRef.current = null;

    try {
      processorRef.current?.disconnect();
    } catch {
      /* noop */
    }
    processorRef.current = null;

    try {
      sourceRef.current?.disconnect();
    } catch {
      /* noop */
    }
    sourceRef.current = null;

    try {
      mutedRef.current?.disconnect();
    } catch {
      /* noop */
    }
    mutedRef.current = null;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }

    clientRef.current?.close();
    clientRef.current = null;

    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {
        /* noop */
      });
    }
    audioCtxRef.current = null;
    playbackCursorRef.current = 0;

    setStateSynced('idle');
    if (mountedRef.current) transition('idle');

    tearingDownRef.current = false;
  }, [transition, setStateSynced]);

  const stop = useCallback(() => {
    cleanup();
    release();
    onEnd?.();
  }, [cleanup, release, onEnd]);

  const fail = useCallback(
    (message: string) => {
      setStateSynced('error');
      cleanup();
      release();
      onError?.(message);
    },
    [cleanup, release, onError, setStateSynced],
  );

  const start = useCallback(async () => {
    // Respect the existing text-only preference semantic on main. The enum
    // rename per Yair's Apr 16 spec lives in closed MR !60 and has not
    // been re-landed; until it is, `text_only` means "no voice".
    if (preference === 'text_only') {
      onError?.('Voice is disabled. Change your preference in Settings.');
      return;
    }

    // Reject re-entry while a previous session is tearing down (onClose →
    // stop() → onEnd → start() would otherwise race with cleanup()).
    if (tearingDownRef.current) return;
    if (clientRef.current) return; // already running

    if (!enterRealtime()) {
      onError?.('Could not acquire the voice channel.');
      return;
    }
    registerCleanup(stop);

    setStateSynced('connecting');

    const agentId = import.meta.env.VITE_CARTESIA_AGENT_ID as string | undefined;
    if (!agentId) {
      fail('VITE_CARTESIA_AGENT_ID is not configured.');
      return;
    }

    const abort = new AbortController();
    abortRef.current = abort;
    const isSuperseded = () => abort.signal.aborted || !mountedRef.current;

    let token: string;
    try {
      token = await fetchAccessToken(abort.signal);
    } catch (err) {
      if (isSuperseded()) return;
      fail(err instanceof Error ? err.message : 'Failed to mint access token.');
      return;
    }
    if (isSuperseded()) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      if (isSuperseded()) return;
      fail(err instanceof Error ? err.message : 'Microphone access was denied.');
      return;
    }
    // Mic permission dialog can resolve after the caller aborted. Tear the
    // just-granted stream down instead of leaking it into a stale session.
    if (isSuperseded()) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    streamRef.current = stream;

    // AudioContext drives both capture (ScriptProcessor) and playback
    // (scheduled AudioBufferSourceNodes). We use the default context
    // sample rate for output so playback matches the device.
    const AudioCtx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    audioCtxRef.current = audioCtx;
    playbackCursorRef.current = audioCtx.currentTime;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const processor = audioCtx.createScriptProcessor(CAPTURE_BUFFER_SIZE, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (evt) => {
      const client = clientRef.current;
      if (!client || client.getState() !== 'open') return;
      const input = evt.inputBuffer.getChannelData(0);
      const resampled = downsample(input, evt.inputBuffer.sampleRate, INPUT_SAMPLE_RATE);
      client.sendAudio(float32ToPcm16LE(resampled));
    };
    source.connect(processor);
    // ScriptProcessor needs a destination to fire events. Route through a
    // zero-gain node so the user's own mic doesn't echo back to them.
    const muted = audioCtx.createGain();
    muted.gain.value = 0;
    processor.connect(muted);
    muted.connect(audioCtx.destination);
    mutedRef.current = muted;

    const client = new CartesiaAgentClient({
      agentId,
      accessToken: token,
      metadata,
      inputFormat: INPUT_FORMAT,
      outputFormat: OUTPUT_FORMAT,
      onReady: () => {
        setStateSynced('listening');
        if (mountedRef.current) transition('listening');
      },
      onAudio: (pcm) => {
        const ctx = audioCtxRef.current;
        if (!ctx || ctx.state === 'closed') return;
        const buffer = pcm16LEToAudioBuffer(ctx, pcm, OUTPUT_SAMPLE_RATE);
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        const startAt = Math.max(playbackCursorRef.current, ctx.currentTime);
        node.start(startAt);
        playbackCursorRef.current = startAt + buffer.duration;
        // Read live state via ref — the closure would otherwise see the
        // render-time value and the transition would fire on every chunk.
        if (stateRef.current !== 'speaking') {
          setStateSynced('speaking');
          if (mountedRef.current) transition('speaking');
        }
      },
      onClear: () => {
        playbackCursorRef.current = audioCtxRef.current?.currentTime ?? 0;
        setStateSynced('listening');
        if (mountedRef.current) transition('listening');
      },
      onError: (err) => fail(err.message),
      onClose: () => stop(),
    });
    clientRef.current = client;

    try {
      client.connect();
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Failed to open agent session.');
    }
  }, [
    preference,
    enterRealtime,
    registerCleanup,
    stop,
    metadata,
    transition,
    fail,
    onError,
    setStateSynced,
  ]);

  return {
    start,
    stop,
    state,
    isActive: state === 'listening' || state === 'thinking' || state === 'speaking',
  };
}
