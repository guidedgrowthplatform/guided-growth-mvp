// Soniox realtime STT streaming client. Pure testable core + thin browser layer.
import { takeTempKey } from '@/lib/services/soniox-temp-key-cache';
import { useAudioMetricsStore } from '@/stores/audioMetricsStore';

export type SonioxState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'responding'
  | 'finalizing'
  | 'error';

// Minimal socket abstraction so the core is testable with a fake.
export interface SonioxSocket {
  send(data: string | ArrayBufferLike): void;
  close(): void;
  onOpen(cb: () => void): void;
  onMessage(cb: (data: string) => void): void;
  onError(cb: (e: unknown) => void): void;
  onClose(cb: (code?: number) => void): void;
}

export interface SonioxConfig {
  model: string;
  sampleRate: number;
  languageHints: string[];
  contextTerms: string[];
}

export interface SonioxCoreDeps {
  url: string;
  openSocket: (url: string) => SonioxSocket;
  getTempKey: () => Promise<string>;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onStateChange: (s: SonioxState) => void;
  onError: (msg: string) => void;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (h: unknown) => void;
  config?: Partial<SonioxConfig>;
  keepAliveMs?: number;
  maxReconnects?: number;
  maxLifetimeReconnects?: number;
}

export interface SonioxSession {
  start(): void;
  feedAudio(frame: Int16Array): void;
  setResponding(responding: boolean): void;
  finalize(): void;
  dispose(): void;
  getState(): SonioxState;
}

const DEFAULT_CONFIG: SonioxConfig = {
  model: 'stt-rt-v4',
  sampleRate: 16000,
  languageHints: ['en'],
  // Small habit/metric vocab to bias recognition.
  contextTerms: ['habit', 'streak', 'check-in', 'reflection', 'metric', 'mood', 'energy', 'sleep'],
};

const DEFAULT_KEEPALIVE_MS = 15000;
const DEFAULT_MAX_RECONNECTS = 2;
const DEFAULT_MAX_LIFETIME_RECONNECTS = 6;
const RECONNECT_DELAY_MS = 500;
const FINALIZE_TIMEOUT_MS = 3000;

// <end> = endpoint detection; <fin> = manual-finalize response. Both terminal.
const END_MARKERS = new Set(['<end>', '<fin>']);

interface SonioxToken {
  text?: string;
  is_final?: boolean;
  is_end?: boolean;
  end?: boolean;
}

// Tolerant end-of-utterance detection — one-line change if the real shape differs.
function isEndToken(tok: SonioxToken): boolean {
  return (
    (tok.text !== undefined && END_MARKERS.has(tok.text)) || tok.is_end === true || tok.end === true
  );
}

export function createSonioxSession(deps: SonioxCoreDeps): SonioxSession {
  const config: SonioxConfig = { ...DEFAULT_CONFIG, ...deps.config };
  const keepAliveMs = deps.keepAliveMs ?? DEFAULT_KEEPALIVE_MS;
  const maxReconnects = deps.maxReconnects ?? DEFAULT_MAX_RECONNECTS;
  const maxLifetimeReconnects = deps.maxLifetimeReconnects ?? DEFAULT_MAX_LIFETIME_RECONNECTS;

  let socket: SonioxSocket | null = null;
  let state: SonioxState = 'idle';
  let disposed = false;
  let committed = '';
  let interim = '';
  let keepAliveHandle: unknown = null;
  let reconnectHandle: unknown = null;
  let finalizeHandle: unknown = null;
  let reconnectsLeft = maxReconnects;
  // never resets — bounds reopen/drop flap loops
  let totalReconnects = 0;
  let lastAudioAt = 0;
  // Distinguishes intentional close (dispose/finalize) from unexpected drops.
  let closingIntentionally = false;
  // finalize() flushes the next final/end then closes.
  let pendingFinalize = false;

  function setState(next: SonioxState): void {
    state = next;
    if (disposed) return;
    deps.onStateChange(next);
  }

  function clearKeepAlive(): void {
    if (keepAliveHandle !== null) {
      deps.clearTimer(keepAliveHandle);
      keepAliveHandle = null;
    }
  }

  function scheduleKeepAlive(): void {
    clearKeepAlive();
    keepAliveHandle = deps.setTimer(() => {
      if (disposed || !socket) return;
      // recent audio counts as activity
      if (deps.now() - lastAudioAt < keepAliveMs) {
        scheduleKeepAlive();
        return;
      }
      // Soniox drops idle sockets >20s; nudge before that.
      try {
        socket.send(JSON.stringify({ type: 'keepalive' }));
      } catch {
        /* socket gone */
      }
      scheduleKeepAlive();
    }, keepAliveMs);
  }

  function clearReconnect(): void {
    if (reconnectHandle !== null) {
      deps.clearTimer(reconnectHandle);
      reconnectHandle = null;
    }
  }

  function clearFinalize(): void {
    if (finalizeHandle !== null) {
      deps.clearTimer(finalizeHandle);
      finalizeHandle = null;
    }
  }

  function flushFinal(): void {
    const text = committed.trim();
    committed = '';
    interim = '';
    if (text && !disposed) deps.onFinal(text);
  }

  function handleMessage(raw: string): void {
    if (disposed) return;
    let parsed: { tokens?: SonioxToken[]; finished?: boolean } | null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed) return;

    let sawEnd = false;
    const tokens = Array.isArray(parsed.tokens) ? parsed.tokens : [];
    interim = '';
    for (const tok of tokens) {
      if (isEndToken(tok)) {
        sawEnd = true;
        continue; // exclude marker from transcript
      }
      const text = tok.text ?? '';
      // Soniox sends each final token once (incremental), so we accumulate.
      if (tok.is_final) committed += text;
      else interim += text;
    }

    const terminal = sawEnd || parsed.finished === true;

    if (terminal) {
      flushFinal();
      if (pendingFinalize) {
        clearFinalize();
        closeSocket();
        dispose();
        return;
      }
      setState('listening');
      return;
    }

    deps.onInterim(committed + interim);
  }

  function closeSocket(): void {
    if (socket) {
      closingIntentionally = true;
      try {
        socket.close();
      } catch {
        /* noop */
      }
      socket = null;
    }
  }

  function handleUnexpectedDrop(): void {
    // pendingFinalize: reconnecting here would orphan a socket the caller dropped
    if (disposed || closingIntentionally || pendingFinalize) return;
    clearKeepAlive();
    socket = null;
    if (reconnectsLeft > 0 && totalReconnects < maxLifetimeReconnects) {
      reconnectsLeft -= 1;
      totalReconnects += 1;
      // Mint a fresh single-use key on each reconnect; old key dies with its socket.
      clearReconnect();
      reconnectHandle = deps.setTimer(() => {
        if (disposed) return;
        start();
      }, RECONNECT_DELAY_MS);
      return;
    }
    // preserve trailing final before erroring out
    flushFinal();
    if (!disposed) deps.onError('voice connection lost');
    setState('error');
  }

  function start(): void {
    if (disposed) return;
    closingIntentionally = false;
    setState('connecting');
    deps
      .getTempKey()
      .then((tempKey) => {
        if (disposed) return;
        const sock = deps.openSocket(deps.url);
        socket = sock;

        sock.onOpen(() => {
          if (disposed || socket !== sock) return;
          sock.send(
            JSON.stringify({
              api_key: tempKey,
              model: config.model,
              audio_format: 'pcm_s16le',
              sample_rate: config.sampleRate,
              num_channels: 1,
              language_hints: config.languageHints,
              enable_endpoint_detection: true,
              context: { terms: config.contextTerms },
            }),
          );
          // No server ack — audio may flow immediately.
          // Healthy connection resets the (consecutive-failure) reconnect budget.
          reconnectsLeft = maxReconnects;
          setState('listening');
          scheduleKeepAlive();
        });

        sock.onMessage((data) => {
          if (socket !== sock) return;
          handleMessage(data);
        });

        sock.onError(() => {
          if (socket !== sock) return;
          handleUnexpectedDrop();
        });

        sock.onClose(() => {
          if (socket !== sock) return;
          handleUnexpectedDrop();
        });
      })
      .catch(() => {
        if (disposed) return;
        handleUnexpectedDrop();
      });
  }

  function feedAudio(frame: Int16Array): void {
    if (disposed || state !== 'listening' || !socket) return;
    lastAudioAt = deps.now();
    try {
      socket.send(frame.buffer);
    } catch {
      /* socket gone */
    }
  }

  function setResponding(responding: boolean): void {
    if (disposed) return;
    if (responding) setState('responding');
    else if (state === 'responding') setState('listening');
  }

  function finalize(): void {
    if (disposed) return;
    pendingFinalize = true;
    setState('finalizing');
    if (socket) {
      try {
        socket.send(JSON.stringify({ type: 'finalize' }));
      } catch {
        /* noop */
      }
      // Watchdog: if the terminal token never arrives, force teardown.
      clearFinalize();
      finalizeHandle = deps.setTimer(() => {
        if (disposed) return;
        flushFinal();
        dispose();
      }, FINALIZE_TIMEOUT_MS);
    } else {
      // No socket to flush from — tear down directly.
      flushFinal();
      dispose();
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    clearKeepAlive();
    clearReconnect();
    clearFinalize();
    closeSocket();
  }

  function getState(): SonioxState {
    return state;
  }

  return { start, feedAudio, setResponding, finalize, dispose, getState };
}

// ---------- Browser layer (thin; not unit-tested in node) ----------

export interface BrowserSttHandle {
  setResponding(responding: boolean): void;
  stop(): void;
}

export interface ConnectMetrics {
  mic_ms: number;
  audio_setup_ms: number;
  key_ms: number;
  ws_ms: number;
  total_ms: number;
  cached: boolean;
}

export interface StartBrowserSttOpts {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onStateChange: (s: SonioxState) => void;
  onError: (msg: string) => void;
  onConnected?: (m: ConnectMetrics) => void;
  config?: Partial<SonioxConfig>;
}

// First call returns the warm key; later calls re-mint — keys are single-use.
export function createPrimedKeyGetter(
  primed: Promise<string>,
  fresh: () => Promise<string>,
): () => Promise<string> {
  let used = false;
  return () => {
    if (!used) {
      used = true;
      return primed;
    }
    return fresh();
  };
}

// Drop-oldest ring, bounded by total samples.
export class BoundedPcmBuffer {
  private frames: Int16Array[] = [];
  private total = 0;
  constructor(private readonly maxSamples: number) {}
  push(frame: Int16Array): void {
    this.frames.push(frame);
    this.total += frame.length;
    while (this.total > this.maxSamples && this.frames.length > 0) {
      this.total -= this.frames.shift()!.length;
    }
  }
  drain(): Int16Array[] {
    const out = this.frames;
    this.frames = [];
    this.total = 0;
    return out;
  }
  get size(): number {
    return this.total;
  }
}

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const TARGET_RATE = 16000;
// 120ms @ 16k — batch tiny worklet quanta to avoid ~375 sends/sec.
const FRAME_SAMPLES_16K = 1920;

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

// Per-frame synchronous linear interpolation down to 16k. No OfflineAudioContext.
// Never upsamples — sub-16k contexts (rare BT profiles) pass through as-is.
function downsampleTo16k(float32: Float32Array, srcRate: number): Float32Array {
  if (srcRate <= TARGET_RATE) return float32;
  const ratio = srcRate / TARGET_RATE;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, float32.length - 1);
    const frac = srcIdx - i0;
    out[i] = float32[i0] * (1 - frac) + float32[i1] * frac;
  }
  return out;
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const v = Math.max(-1, Math.min(1, float32[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

const WORKLET_CODE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) this.port.postMessage(new Float32Array(input));
    return true;
  }
}
registerProcessor('soniox-capture-processor', CaptureProcessor);
`;

function realSocketAdapter(url: string): SonioxSocket {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  return {
    send: (data) => ws.send(data as string | ArrayBufferLike),
    close: () => ws.close(),
    onOpen: (cb) => {
      ws.onopen = () => cb();
    },
    onMessage: (cb) => {
      ws.onmessage = (ev: MessageEvent) => {
        // Soniox messages arrive as strings; tolerate blobs defensively.
        if (typeof ev.data === 'string') cb(ev.data);
        else if (ev.data instanceof ArrayBuffer) cb(new TextDecoder().decode(ev.data));
      };
    },
    onError: (cb) => {
      ws.onerror = (e) => cb(e);
    },
    onClose: (cb) => {
      ws.onclose = (e: CloseEvent) => cb(e.code);
    },
  };
}

const CONNECT_TIMEOUT_MS = 7000;
// armed but zero audio frames — dead capture; else orb sits on 'listening' forever
const ARM_TIMEOUT_MS = 12000;
// 1.5s @ 16k — opening words captured before the socket reaches 'listening'.
const PREBUFFER_MAX_SAMPLES = 24000;

// VAD hysteresis. The local graph stays warm while armed (free); the paid
// Soniox socket opens only on sustained speech and closes after silence.
const VAD_OPEN_RMS = 0.01;
const VAD_OPEN_SUSTAIN_MS = 150;
const VAD_SILENCE_CLOSE_MS = 2500;
// smooth per-quantum RMS for VAD — raw quanta are too jittery to gate on
const VAD_RMS_EMA_ALPHA = 0.2;

export interface VadState {
  speechStartedAt: number;
  lastSpeechAt: number;
}

export function emptyVadState(): VadState {
  return { speechStartedAt: 0, lastSpeechAt: 0 };
}

export function updateVad(vad: VadState, rms: number, now: number): VadState {
  if (rms >= VAD_OPEN_RMS) {
    return {
      speechStartedAt: vad.speechStartedAt === 0 ? now : vad.speechStartedAt,
      lastSpeechAt: now,
    };
  }
  return { speechStartedAt: 0, lastSpeechAt: vad.lastSpeechAt };
}

export function shouldOpenSocket(vad: VadState, now: number, hasSocket: boolean): boolean {
  return (
    !hasSocket && vad.speechStartedAt !== 0 && now - vad.speechStartedAt >= VAD_OPEN_SUSTAIN_MS
  );
}

export function shouldCloseSocket(vad: VadState, now: number, hasSocket: boolean): boolean {
  return hasSocket && vad.lastSpeechAt !== 0 && now - vad.lastSpeechAt >= VAD_SILENCE_CLOSE_MS;
}

export function startSonioxBrowserSession(opts: StartBrowserSttOpts): BrowserSttHandle {
  // Local audio resources — module owns its own, never stt-service globals.
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let captureNode: ScriptProcessorNode | AudioWorkletNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let stopped = false;
  let armed = false;
  // True once any audio frame arrives — distinguishes a dead mic from a quiet user.
  let framesSeen = false;
  let pcmBuffer = new Float32Array(0);

  const tBootStart = performance.now();
  let micMs = 0;
  let audioSetupMs = 0;
  let connectMetricsSent = false;
  const prebuf = new BoundedPcmBuffer(PREBUFFER_MAX_SAMPLES);

  // One Soniox socket per utterance; null while armed-and-silent.
  let session: SonioxSession | null = null;
  let sessionListening = false;
  let responding = false;
  let vad = emptyVadState();
  let vadRmsEma = 0;
  let sessionWatchdog: ReturnType<typeof setTimeout> | null = null;
  let armWatchdog: ReturnType<typeof setTimeout> | null = null;
  let visibilityHandler: (() => void) | null = null;

  function clearSessionWatchdog(): void {
    if (sessionWatchdog !== null) {
      clearTimeout(sessionWatchdog);
      sessionWatchdog = null;
    }
  }

  function clearArmWatchdog(): void {
    if (armWatchdog !== null) {
      clearTimeout(armWatchdog);
      armWatchdog = null;
    }
  }

  function openSocket(): void {
    if (session || stopped || !armed) return;
    clearArmWatchdog(); // socket attempt underway; per-socket watchdog owns connect
    const isFirst = !connectMetricsSent;
    let connectingAt = 0;
    let keyMs = 0;
    let cachedKey = false;

    // Fresh single-use key per socket; first one drains the warm cache.
    const getTempKey = () => {
      const t = performance.now();
      return takeTempKey().then((r) => {
        if (isFirst) {
          keyMs = performance.now() - t;
          cachedKey = r.cached;
        }
        return r.apiKey;
      });
    };

    clearSessionWatchdog();
    sessionWatchdog = setTimeout(() => {
      sessionWatchdog = null;
      if (stopped || sessionListening) return;
      opts.onError('voice connection timed out');
      stop();
    }, CONNECT_TIMEOUT_MS);

    const s = createSonioxSession({
      url: SONIOX_WS_URL,
      openSocket: realSocketAdapter,
      getTempKey,
      onInterim: opts.onInterim,
      onFinal: opts.onFinal,
      onStateChange: (st) => {
        if (st === 'connecting' && connectingAt === 0) connectingAt = performance.now();
        if (st === 'error') clearSessionWatchdog();
        // Re-arm on every 'listening' (incl. reconnect) and before draining,
        // else prebuffered echo feeds through while muted.
        if (st === 'listening' && responding) s.setResponding(true);
        if (st === 'listening' && !sessionListening) {
          sessionListening = true;
          clearSessionWatchdog();
          for (const f of prebuf.drain()) s.feedAudio(f);
          if (isFirst && !connectMetricsSent) {
            connectMetricsSent = true;
            const tListen = performance.now();
            opts.onConnected?.({
              mic_ms: Math.round(micMs),
              audio_setup_ms: Math.round(audioSetupMs),
              key_ms: Math.round(keyMs),
              ws_ms: connectingAt ? Math.round(tListen - connectingAt) : 0,
              total_ms: Math.round(tListen - tBootStart),
              cached: cachedKey,
            });
          }
        }
      },
      onError: (msg) => {
        clearSessionWatchdog();
        if (!stopped) opts.onError(msg);
        stop();
      },
      now: () => performance.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      config: opts.config,
    });
    session = s;
    s.start();
  }

  // Close the paid socket after an utterance; graph stays warm (ripple alive).
  function endUtterance(): void {
    if (!session) return;
    const s = session;
    session = null;
    sessionListening = false;
    vad = emptyVadState();
    clearSessionWatchdog();
    prebuf.drain(); // start the next utterance's lead-in clean
    s.finalize();
  }

  function emitFrame(frame: Int16Array): void {
    // armed-silent or connecting → retain in prebuffer, drained on 'listening'
    if (session && sessionListening) session.feedAudio(frame);
    else prebuf.push(frame);
  }

  function onFrame(float32: Float32Array, srcRate: number): void {
    if (stopped) return;
    framesSeen = true;
    const now = performance.now();
    const rms = computeRms(float32);
    // raw RMS drives the ripple (responsive); EMA drives VAD (stable)
    useAudioMetricsStore.getState().pushChunkRms(rms);
    vadRmsEma = vadRmsEma * (1 - VAD_RMS_EMA_ALPHA) + rms * VAD_RMS_EMA_ALPHA;
    vad = updateVad(vad, vadRmsEma, now);
    // !responding: don't open a fresh socket on TTS echo while the coach speaks.
    if (armed && !responding && shouldOpenSocket(vad, now, session !== null)) openSocket();
    // Only finalize a session that's actually reached 'listening' — closing it
    // mid-handshake aborts the WS upgrade and the user sees
    // "WebSocket closed before connection established". On slow links (high
    // RTT to Soniox) the connect can take 2-3s; the VAD silence timer would
    // otherwise fire first and kill the still-connecting socket.
    else if (shouldCloseSocket(vad, now, sessionListening)) endUtterance();

    const down = downsampleTo16k(float32, srcRate);
    const merged = new Float32Array(pcmBuffer.length + down.length);
    merged.set(pcmBuffer);
    merged.set(down, pcmBuffer.length);
    pcmBuffer = merged;
    while (pcmBuffer.length >= FRAME_SAMPLES_16K) {
      emitFrame(float32ToInt16(pcmBuffer.subarray(0, FRAME_SAMPLES_16K)));
      pcmBuffer = pcmBuffer.slice(FRAME_SAMPLES_16K);
    }
  }

  // trailing partial — else last <120ms lost on stop
  function flushBuffer(): void {
    if (pcmBuffer.length > 0) {
      emitFrame(float32ToInt16(pcmBuffer));
      pcmBuffer = new Float32Array(0);
    }
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    armed = false;
    clearSessionWatchdog();
    clearArmWatchdog();
    // drain before mic-off — feedAudio gated on 'listening'
    flushBuffer();
    if (session) {
      const s = session;
      session = null;
      sessionListening = false;
      s.finalize();
    }
    cleanup();
  }

  function setupScriptProcessorFallback(
    ctx: AudioContext,
    source: MediaStreamAudioSourceNode,
  ): void {
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const srcRate = ctx.sampleRate;
    node.onaudioprocess = (e: AudioProcessingEvent) => {
      if (captureNode === null) return;
      onFrame(new Float32Array(e.inputBuffer.getChannelData(0)), srcRate);
    };
    source.connect(node);
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    node.connect(silentGain);
    silentGain.connect(ctx.destination);
    captureNode = node;
  }

  function cleanup(): void {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (captureNode) {
      if (captureNode instanceof AudioWorkletNode) captureNode.port.close();
      captureNode.disconnect();
      captureNode = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      try {
        audioContext.close();
      } catch {
        /* ignore */
      }
      audioContext = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    useAudioMetricsStore.getState().reset();
  }

  async function boot(): Promise<void> {
    try {
      const micStart = performance.now();
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micMs = performance.now() - micStart;
      if (stopped) return cleanup();
      const audioStart = performance.now();
      // Browsers may ignore the requested rate; read back the actual one.
      try {
        audioContext = new AudioContext({ sampleRate: TARGET_RATE });
      } catch {
        audioContext = new AudioContext();
      }
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (stopped) return cleanup();
      const actualRate = audioContext.sampleRate;
      sourceNode = audioContext.createMediaStreamSource(mediaStream);

      if (audioContext.audioWorklet) {
        try {
          const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          await audioContext.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);
          if (stopped) return cleanup();
          const workletNode = new AudioWorkletNode(audioContext, 'soniox-capture-processor');
          workletNode.port.onmessage = (e: MessageEvent) => {
            if (captureNode === null) return;
            onFrame(new Float32Array(e.data), actualRate);
          };
          sourceNode.connect(workletNode);
          const silentGain = audioContext.createGain();
          silentGain.gain.value = 0;
          workletNode.connect(silentGain);
          silentGain.connect(audioContext.destination);
          captureNode = workletNode;
        } catch {
          setupScriptProcessorFallback(audioContext, sourceNode);
        }
      } else {
        setupScriptProcessorFallback(audioContext, sourceNode);
      }

      if (stopped) {
        cleanup();
        return;
      }
      audioSetupMs = performance.now() - audioStart;
      // iOS suspends the AudioContext on background; resume on return.
      visibilityHandler = () => {
        if (stopped || !armed) return;
        if (document.visibilityState === 'visible' && audioContext?.state === 'suspended') {
          void audioContext.resume();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      // Armed: graph runs + ripple is live; the socket opens on first speech.
      armed = true;
      opts.onStateChange('listening');
      armWatchdog = setTimeout(() => {
        armWatchdog = null;
        // Only a truly dead capture (zero frames) is an error; a quiet/thinking
        // user still emits frames (ripple stays live) and must not be kicked.
        if (stopped || session || connectMetricsSent || framesSeen) return;
        opts.onError('microphone not capturing audio');
        stop();
      }, ARM_TIMEOUT_MS);
    } catch (err) {
      cleanup();
      if (!stopped) opts.onError(err instanceof Error ? err.message : 'Mic capture failed');
    }
  }

  void boot();

  return {
    setResponding: (r) => {
      responding = r;
      session?.setResponding(r);
    },
    stop,
  };
}
