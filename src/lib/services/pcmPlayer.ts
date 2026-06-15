// Gapless WebAudio playback of streamed raw PCM (s16le). One active stream at a
// time — matches one coach TTS turn. Used by cartesia-ws.ts.

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// Jitter buffer: schedule the first frame this far ahead so network gaps between
// frames don't underrun the output.
const SCHED_LEAD_S = 0.08;
const DEFAULT_VOLUME = 0.85;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

interface StreamState {
  nextStartTime: number;
  sources: Set<AudioBufferSourceNode>;
  started: boolean;
  finalized: boolean;
  sampleRate: number;
  firstAudioTimer: ReturnType<typeof setTimeout> | null;
  onFirstAudio?: () => void;
  onDrain?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

let stream: StreamState | null = null;

export function pcmSupported(): boolean {
  return typeof window !== 'undefined' && (!!window.AudioContext || !!window.webkitAudioContext);
}

function ensureContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = DEFAULT_VOLUME;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

// Call from a user gesture (mic tap / page entry) so iOS allows playback.
export function unlockPcmAudio(): void {
  if (!pcmSupported()) return;
  const c = ensureContext();
  if (c.state === 'suspended') void c.resume();
}

export function pcmBegin(opts?: {
  onFirstAudio?: () => void;
  onDrain?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
  sampleRate?: number;
}): void {
  pcmStop();
  ensureContext();
  stream = {
    nextStartTime: 0,
    sources: new Set(),
    started: false,
    finalized: false,
    sampleRate: opts?.sampleRate ?? 24000,
    firstAudioTimer: null,
    onFirstAudio: opts?.onFirstAudio,
    onDrain: opts?.onDrain,
    onSpeakingChange: opts?.onSpeakingChange,
  };
}

export function s16leToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = bytes.byteLength >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return out;
}

export function pcmEnqueue(bytes: Uint8Array): void {
  const s = stream;
  if (!s || !ctx || !masterGain || bytes.byteLength < 2) return;
  // Best-effort: recovers a post-unlock suspension, NOT a cold autoplay lock.
  if (ctx.state === 'suspended') void ctx.resume();

  const f32 = s16leToFloat32(bytes);
  const buf = ctx.createBuffer(1, f32.length, s.sampleRate);
  buf.getChannelData(0).set(f32);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(masterGain);

  const now = ctx.currentTime;
  if (s.nextStartTime < now + 0.01) s.nextStartTime = now + SCHED_LEAD_S;
  const startAt = s.nextStartTime;
  src.start(startAt);
  s.nextStartTime += buf.duration;

  if (!s.started) {
    s.started = true;
    s.onSpeakingChange?.(true);
    s.firstAudioTimer = setTimeout(
      () => {
        if (s === stream) s.onFirstAudio?.();
      },
      Math.max(0, (startAt - now) * 1000),
    );
  }

  s.sources.add(src);
  src.onended = () => {
    s.sources.delete(src);
    maybeDrain(s);
  };
}

// No more frames will arrive — drain once the scheduled tail finishes.
export function pcmFinish(): void {
  if (!stream) return;
  stream.finalized = true;
  maybeDrain(stream);
}

function maybeDrain(s: StreamState): void {
  if (s !== stream) return;
  if (!s.finalized || s.sources.size > 0) return;
  s.onSpeakingChange?.(false);
  s.onDrain?.();
  stream = null;
}

export function pcmStop(): void {
  const s = stream;
  stream = null;
  if (!s) return;
  if (s.firstAudioTimer) clearTimeout(s.firstAudioTimer);
  for (const src of s.sources) {
    try {
      src.onended = null;
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  s.sources.clear();
  s.onSpeakingChange?.(false);
}
