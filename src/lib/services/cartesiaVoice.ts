import { create } from 'zustand';
import { COACH_VOICE_ID } from '@/config/voiceConfig';
import { getApiBase, getAuthHeaders } from '@/lib/services/api-auth';
import { cleanText, setTtsSpeaking } from '@/lib/services/tts-service';
import { isVoiceOutEnabled } from '@/lib/services/voiceGate';
import { countWords } from '@/lib/text/words';

// Dynamic coach voice: Cartesia /tts/sse (raw PCM + word_timestamps) → Web Audio,
// with a word-level reveal paced off the real audio clock.

// revealedWords is a count; the consumer clamps its text to it.
export const useCartesiaRevealStore = create<{
  revealedWords: number;
  active: boolean;
}>(() => ({ revealedWords: 0, active: false }));

const SSE_SAMPLE_RATE = 24000; // must match api/cartesia-tts-sse.ts
const SCHEDULE_LEAD_S = 0.06; // small lead so the first buffer never starts in the past
const VOLUME = 0.85;

let audioCtx: AudioContext | null = null;
let gain: GainNode | null = null;

function ctx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  gain = audioCtx.createGain();
  gain.gain.value = VOLUME;
  gain.connect(audioCtx.destination);
  return audioCtx;
}

// Call from a user gesture (mic tap) — iOS/Capacitor require resume() in-gesture.
export function unlockCartesiaVoice(): void {
  const c = ctx();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

// ── Turn state ───────────────────────────────────────────────────────────────
let generation = 0;
let queue: string[] = [];
let draining = false;
let sealed = false;
let nextStartTime = 0;
let wordOnsets: number[] = []; // absolute ctx-time onsets, in speaking order
let totalWords = 0;
let sources: AudioBufferSourceNode[] = [];
let revealRaf: number | null = null;
let speaking = false;
let authHeaders: Record<string, string> = {};
// Awaited by the coach hook; resolves when the turn's audio ends or is stopped.
let turnResolvers: Array<() => void> = [];

function resolveTurn(): void {
  const rs = turnResolvers;
  turnResolvers = [];
  rs.forEach((r) => r());
}

function resetTurnState(): void {
  queue = [];
  draining = false;
  sealed = false;
  nextStartTime = 0;
  wordOnsets = [];
  totalWords = 0;
  sources = [];
  useCartesiaRevealStore.setState({ revealedWords: 0, active: true });
}

export function beginVoiceTurn(): number {
  stopVoice();
  generation += 1;
  const gen = generation;
  resetTurnState();
  return gen;
}

export function pushVoiceChunk(text: string): void {
  if (!text.trim() || !isVoiceOutEnabled()) return;
  queue.push(text);
  if (!draining) void drain(generation);
}

export function endVoiceTurn(): Promise<void> {
  sealed = true;
  const gen = generation;
  const p = new Promise<void>((resolve) => turnResolvers.push(resolve));
  // Nothing left to play (all chunks done/failed) → settle now.
  if (!draining && !useCartesiaRevealStore.getState().active) resolveTurn();
  else maybeFinish(gen);
  return p;
}

export function stopVoice(): void {
  generation += 1; // invalidate any in-flight drain / synth
  for (const s of sources) {
    try {
      s.onended = null;
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  sources = [];
  queue = [];
  draining = false;
  sealed = false;
  wordOnsets = [];
  totalWords = 0;
  if (revealRaf !== null) {
    cancelAnimationFrame(revealRaf);
    revealRaf = null;
  }
  if (speaking) {
    speaking = false;
    setTtsSpeaking(false);
  }
  useCartesiaRevealStore.setState({ active: false });
  resolveTurn();
}

// ── Drain: synth each chunk, schedule gaplessly ──────────────────────────────
async function drain(gen: number): Promise<void> {
  draining = true;
  const c = ctx();
  if (!c) {
    draining = false;
    return;
  }
  if (c.state === 'suspended') await c.resume().catch(() => undefined);
  if (gen !== generation) return;
  if (c.state !== 'running') {
    // autoplay-locked ctx → frozen clock would hang the turn
    queue = [];
    draining = false;
    maybeFinish(gen);
    return;
  }

  authHeaders = await getAuthHeaders();
  if (gen !== generation) return;

  while (queue.length > 0) {
    const text = queue.shift() as string;
    const localCount = countWords(text);
    const spoken = cleanText(text);
    let decoded: DecodedChunk | null = null;
    if (spoken) {
      try {
        decoded = await synthChunk(spoken, gen);
      } catch {
        decoded = null;
      }
    }
    if (gen !== generation) return;
    let scheduled = false;
    if (decoded && decoded.samples.length > 0) {
      try {
        scheduleChunk(c, decoded, gen, localCount);
        scheduled = true;
      } catch {
        // don't wedge draining=true
      }
    }
    // failed/empty chunk → reveal its words immediately so the count never lags
    if (!scheduled && localCount > 0) {
      for (let i = 0; i < localCount; i++) wordOnsets.push(0);
      totalWords += localCount;
    }
  }

  draining = false;
  maybeFinish(gen);
}

function scheduleChunk(
  c: AudioContext,
  decoded: DecodedChunk,
  gen: number,
  localCount: number,
): void {
  const buffer = c.createBuffer(1, decoded.samples.length, SSE_SAMPLE_RATE);
  buffer.getChannelData(0).set(decoded.samples);
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(gain ?? c.destination);

  const startAt = Math.max(nextStartTime, c.currentTime + SCHEDULE_LEAD_S);
  src.start(startAt);
  sources.push(src);
  src.onended = () => {
    sources = sources.filter((s) => s !== src);
    // rAF frozen when backgrounded — also finish from the audio callback
    if (sealed && !draining && sources.length === 0) finishTurn(gen);
  };

  // Map Cartesia onsets onto the chunk's own whitespace tokens — reveal count
  // must match sliceWords, not Cartesia's tokenization.
  const m = decoded.starts.length;
  for (let i = 0; i < localCount; i++) {
    const j = m > 0 ? Math.min(m - 1, Math.floor((i * m) / localCount)) : -1;
    wordOnsets.push(j >= 0 ? startAt + decoded.starts[j] : startAt);
  }
  totalWords += localCount;
  nextStartTime = startAt + buffer.duration;

  if (!speaking) {
    speaking = true;
    setTtsSpeaking(true);
  }
  startRevealLoop(gen);
}

function startRevealLoop(gen: number): void {
  if (revealRaf !== null) return;
  const c = audioCtx;
  if (!c) return;
  const tick = () => {
    if (gen !== generation) {
      revealRaf = null;
      return;
    }
    const now = c.currentTime;
    let n = 0;
    while (n < wordOnsets.length && wordOnsets[n] <= now) n++;
    const prev = useCartesiaRevealStore.getState().revealedWords;
    if (n > prev) useCartesiaRevealStore.setState({ revealedWords: n });

    const done = sealed && !draining && now >= nextStartTime;
    if (done) {
      revealRaf = null;
      finishTurn(gen);
      return;
    }
    revealRaf = requestAnimationFrame(tick);
  };
  revealRaf = requestAnimationFrame(tick);
}

function maybeFinish(gen: number): void {
  // mid-drain, empty wordOnsets just means the first chunk isn't synthesized yet
  if (gen !== generation || draining || !sealed) return;
  if (wordOnsets.length === 0) {
    finishTurn(gen);
    return;
  }
  // audio already done while rAF was frozen (backgrounded tab)
  if (sources.length === 0 && audioCtx && audioCtx.currentTime >= nextStartTime) finishTurn(gen);
}

function finishTurn(gen: number): void {
  if (gen !== generation) return;
  if (revealRaf !== null) {
    cancelAnimationFrame(revealRaf);
    revealRaf = null;
  }
  useCartesiaRevealStore.setState({ revealedWords: totalWords, active: false });
  if (speaking) {
    speaking = false;
    setTtsSpeaking(false);
  }
  resolveTurn();
}

// ── SSE fetch + PCM decode ───────────────────────────────────────────────────
interface DecodedChunk {
  samples: Float32Array;
  words: string[];
  starts: number[];
}

async function synthChunk(text: string, gen: number): Promise<DecodedChunk | null> {
  const res = await fetch(`${getApiBase()}/api/cartesia-tts-sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ text: text.trim(), voice_id: COACH_VOICE_ID }),
  });
  if (gen !== generation) return null;
  if (!res.ok) return null;
  const body = await res.text();
  if (gen !== generation) return null;
  return parseSse(body);
}

// Robust on web + Capacitor native (reads full response, no streaming body dep).
export function parseSse(body: string): DecodedChunk | null {
  const pcmParts: Uint8Array[] = [];
  const words: string[] = [];
  const starts: number[] = [];

  for (const block of body.replace(/\r\n/g, '\n').split(/\n\n+/)) {
    const dataLines = block
      .split(/\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (dataLines.length === 0) continue;
    const json = dataLines.join('');
    if (!json || json === '[DONE]') continue;
    let evt: SseEvent;
    try {
      evt = JSON.parse(json) as SseEvent;
    } catch {
      continue;
    }
    if (evt.type === 'chunk' && evt.data) {
      pcmParts.push(base64ToBytes(evt.data));
    } else if (evt.type === 'timestamps' && evt.word_timestamps) {
      const wt = evt.word_timestamps;
      for (let i = 0; i < wt.words.length; i++) {
        words.push(wt.words[i]);
        starts.push(wt.start[i]);
      }
    } else if (evt.type === 'error') {
      return null;
    }
  }
  if (pcmParts.length === 0) return null;
  return { samples: pcmS16leToFloat32(pcmParts), words, starts };
}

interface SseEvent {
  type: 'chunk' | 'timestamps' | 'phoneme_timestamps' | 'done' | 'error';
  data?: string;
  word_timestamps?: { words: string[]; start: number[]; end: number[] };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function pcmS16leToFloat32(parts: Uint8Array[]): Float32Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const merged = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    merged.set(p, off);
    off += p.length;
  }
  const sampleCount = merged.length >> 1; // 2 bytes/sample
  const view = new DataView(merged.buffer, merged.byteOffset, sampleCount * 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}
