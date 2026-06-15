// Client-direct Cartesia TTS over WebSocket with input-streaming continuations.
// One context per coach turn; audio frames stream to pcmPlayer as they arrive.
import { COACH_VOICE_ID } from '@/config/voiceConfig';
import { takeAccessToken } from '@/lib/services/cartesia-token-cache';
import {
  pcmBegin,
  pcmEnqueue,
  pcmFinish,
  pcmScheduleWord,
  pcmStop,
  pcmSupported,
  unlockPcmAudio,
} from './pcmPlayer';

const WS_URL = 'wss://api.cartesia.ai/tts/websocket';
const CARTESIA_VERSION = '2026-03-01';
const MODEL_ID = 'sonic-3';
const SAMPLE_RATE = 24000;
const OPEN_TIMEOUT_MS = 6000;
// Force-drain if the server never sends `done` after we close the context.
const DONE_WATCHDOG_MS = 8000;

interface TurnCallbacks {
  onFirstAudio?: () => void;
  onDrain?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onWord?: (idx: number) => void;
  onError?: (msg: string) => void;
}

interface WordTimestamps {
  words: string[];
  start: number[];
  end: number[];
}

interface ServerMsg {
  type?: string;
  context_id?: string;
  data?: string;
  done?: boolean;
  error_code?: string;
  message?: string;
  word_timestamps?: WordTimestamps;
}

let socket: WebSocket | null = null;
let socketReady: Promise<WebSocket> | null = null;
let currentContextId: string | null = null;
let callbacks: TurnCallbacks = {};
let doneWatchdog: ReturnType<typeof setTimeout> | null = null;
// Cumulative word index across a turn's continued generations.
let turnWordCount = 0;
// Word-onset timeline base — adapts whether Cartesia reports start/end per
// context (cumulative) or per generation (reset). tsLastEnd tracks the running
// context-relative end; a backwards start[] means a per-generation reset.
let tsFrameBase = 0;
let tsLastEnd = 0;

export function wsTtsAvailable(): boolean {
  return typeof WebSocket !== 'undefined' && pcmSupported();
}

function newContextId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `ctx_${crypto.randomUUID()}`;
  } catch {
    /* fall through */
  }
  return `ctx_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function teardownSocket(): void {
  socketReady = null;
  if (socket) {
    const s = socket;
    socket = null;
    s.onmessage = null;
    s.onclose = null;
    s.onerror = null;
    try {
      s.close();
    } catch {
      /* ignore */
    }
  }
}

function handleMessage(raw: string): void {
  let msg: ServerMsg;
  try {
    msg = JSON.parse(raw) as ServerMsg;
  } catch {
    return;
  }
  // Ignore frames for a stale/cancelled context.
  if (msg.context_id && currentContextId && msg.context_id !== currentContextId) return;

  if (msg.type === 'chunk' && msg.data) {
    pcmEnqueue(base64ToBytes(msg.data));
    return;
  }
  if (msg.type === 'timestamps' && msg.word_timestamps) {
    if (!currentContextId) return;
    const { words, start, end } = msg.word_timestamps;
    if (start.length && start[0] + 1e-3 < tsLastEnd) tsFrameBase = tsLastEnd;
    for (let i = 0; i < words.length; i++) {
      pcmScheduleWord(turnWordCount + i, tsFrameBase + start[i]);
      const e = tsFrameBase + end[i];
      if (e > tsLastEnd) tsLastEnd = e;
    }
    turnWordCount += words.length;
    return;
  }
  if (msg.type === 'error') {
    callbacks.onError?.(msg.message || msg.error_code || 'tts ws error');
    clearDoneWatchdog();
    pcmFinish();
    return;
  }
  if (msg.type === 'done' || msg.done === true) {
    clearDoneWatchdog();
    // All audio delivered — drain after the scheduled tail finishes playing.
    pcmFinish();
  }
}

async function ensureSocket(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;
  // Socket past OPEN (CLOSING/CLOSED) but onclose hasn't cleaned up yet — drop it
  // so we don't hand back a dead socket via the stale socketReady promise.
  if (socket && socket.readyState !== WebSocket.CONNECTING) teardownSocket();
  if (socketReady) return socketReady;

  socketReady = (async () => {
    const { accessToken } = await takeAccessToken();
    const url = new URL(WS_URL);
    url.searchParams.set('cartesia_version', CARTESIA_VERSION);
    url.searchParams.set('access_token', accessToken);

    const ws = new WebSocket(url.toString());
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('cartesia ws open timeout')),
        OPEN_TIMEOUT_MS,
      );
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error('cartesia ws connect error'));
      };
    });

    ws.onmessage = (ev) => handleMessage(typeof ev.data === 'string' ? ev.data : '');
    ws.onclose = () => {
      if (socket === ws) teardownSocket();
      // A clean close fires onclose (not onerror); if a turn is live, route to
      // fallback so it isn't silent / stuck on the done watchdog.
      if (currentContextId) callbacks.onError?.('cartesia ws closed');
    };
    ws.onerror = () => {
      callbacks.onError?.('cartesia ws error');
    };
    socket = ws;
    return ws;
  })();

  try {
    return await socketReady;
  } catch (err) {
    socketReady = null;
    throw err;
  }
}

function clearDoneWatchdog(): void {
  if (doneWatchdog) {
    clearTimeout(doneWatchdog);
    doneWatchdog = null;
  }
}

function sendChunk(ws: WebSocket, transcript: string, cont: boolean): void {
  ws.send(
    JSON.stringify({
      context_id: currentContextId,
      model_id: MODEL_ID,
      transcript,
      voice: { mode: 'id', id: COACH_VOICE_ID },
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SAMPLE_RATE },
      language: 'en',
      add_timestamps: true,
      continue: cont,
    }),
  );
}

// Open the socket ahead of the first turn so it pays no connect cost.
export function wsWarm(): void {
  if (!wsTtsAvailable()) return;
  void ensureSocket().catch(() => undefined);
}

// Open a new turn. Pre-warms the socket so the first chunk pays no connect cost.
export function wsBegin(cb: TurnCallbacks): void {
  callbacks = cb;
  currentContextId = newContextId();
  turnWordCount = 0;
  tsFrameBase = 0;
  tsLastEnd = 0;
  clearDoneWatchdog();
  unlockPcmAudio();
  pcmBegin({
    sampleRate: SAMPLE_RATE,
    onFirstAudio: () => cb.onFirstAudio?.(),
    onDrain: () => cb.onDrain?.(),
    onSpeakingChange: (s) => cb.onSpeakingChange?.(s),
    onWord: (idx) => cb.onWord?.(idx),
  });
  void ensureSocket().catch((err) => cb.onError?.(String(err)));
}

export async function wsPush(text: string): Promise<void> {
  const t = text.trim();
  if (!t || !currentContextId) return;
  try {
    const ws = await ensureSocket();
    sendChunk(ws, t, true);
  } catch (err) {
    callbacks.onError?.(String(err));
  }
}

export async function wsFinish(): Promise<void> {
  if (!currentContextId) return;
  try {
    const ws = await ensureSocket();
    sendChunk(ws, '', false);
    doneWatchdog = setTimeout(() => {
      doneWatchdog = null;
      pcmFinish();
    }, DONE_WATCHDOG_MS);
  } catch {
    // socket gone — drain whatever already played
    pcmFinish();
  }
}

export function wsCancel(): void {
  clearDoneWatchdog();
  pcmStop();
  const ctxId = currentContextId;
  currentContextId = null;
  if (ctxId && socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ context_id: ctxId, cancel: true }));
    } catch {
      /* ignore */
    }
  }
}
