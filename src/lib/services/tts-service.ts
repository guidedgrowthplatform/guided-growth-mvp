import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';
import { COACH_VOICE_ID, type VoiceGender } from '@/config/voiceConfig';
import { supabase, sessionReady } from '@/lib/supabase';
import { wsBegin, wsCancel, wsFinish, wsPush, wsTtsAvailable } from './cartesia-ws';
import { unlockPcmAudio } from './pcmPlayer';
import { isVoiceOutEnabled } from './voiceGate';

// Streaming WebSocket transport (low-latency) vs HTTP /tts/bytes batch (fallback).
const TTS_TRANSPORT = (import.meta.env.VITE_TTS_TRANSPORT as string | undefined) ?? 'http';

export const useTtsPlaybackStore = create<{ isSpeaking: boolean }>(() => ({
  isSpeaking: false,
}));

function setSpeaking(value: boolean) {
  if (useTtsPlaybackStore.getState().isSpeaking !== value) {
    useTtsPlaybackStore.setState({ isSpeaking: value });
  }
}

// User selects Male or Female on splash screen
export type { VoiceGender };

const VOICE_GENDER_KEY = 'guided_growth_voice_gender';

/** Get the user's selected voice gender (defaults to female) */
export function getVoiceGender(): VoiceGender {
  try {
    const saved = localStorage.getItem(VOICE_GENDER_KEY);
    if (saved === 'male') return 'male';
  } catch {
    /* ignore */
  }
  return 'female';
}

/** Set the user's voice gender preference */
export function setVoiceGender(gender: VoiceGender): void {
  try {
    localStorage.setItem(VOICE_GENDER_KEY, gender);
  } catch {
    /* ignore */
  }
}

// Gender selection unused post-onboarding; coach always speaks as Yair
function getCartesiaVoiceId(): string {
  return COACH_VOICE_ID;
}

// ─── API Base ───────────────────────────────────────────────────────────────

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[TTS] VITE_API_URL not set — TTS will fail on native');
  }
  return '';
}

/** Get auth headers for the TTS proxy */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    // Await native session hydration — see stt-service.ts for the
    // race-condition rationale. TL;DR: voice fired right after app launch
    // races the Capacitor Preferences loader and gets a null session.
    if (Capacitor.isNativePlatform()) {
      await sessionReady;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Continue without auth
  }
  return {};
}

// Track provider availability (disabled on quota exceeded / auth failure)
let cartesiaTtsAvailable = true;

let currentAudio: HTMLAudioElement | null = null;
let currentTtsAbort: AbortController | null = null;
// stopTTS() invokes this so awaited speak() resolves on external interrupt.
let currentAudioResolver: (() => void) | null = null;
// iOS Safari first-play rule — set by unlockTTS inside a gesture.
let ttsUnlocked = false;
// Bumped per speak()/turn; stale callers bail at each await boundary.
let speakGeneration = 0;

// ─── Chunked speech-turn queue (coach streaming TTS) ─────────────────────────
interface QueueItem {
  text: string;
  volume: number;
}
interface Prefetch {
  text: string;
  gen: number;
  abort: AbortController;
  blob: Promise<Blob | null>;
}
let speechQueue: QueueItem[] = [];
let playCursor = 0;
let drainRunning = false;
let turnActive = false;
let turnSealed = false;
let speakingHeld = false;
let playSynthAbort: AbortController | null = null;
let prefetch: Prefetch | null = null;
let drainResolvers: Array<() => void> = [];
let deferredOneShot: { text: string; volume: number } | null = null;

// ─── WebSocket streaming turn state ──────────────────────────────────────────
let wsTurnActive = false;
let wsFirstAudio = false;
let wsHealthy = true; // flips false on a ws/token failure → fall back to HTTP
let wsTurnChunks: string[] = [];
let wsDrainResolvers: Array<() => void> = [];

function useWs(): boolean {
  return TTS_TRANSPORT === 'ws' && wsHealthy && wsTtsAvailable() && isVoiceOutEnabled();
}

function resolveWsDrainers(): void {
  const rs = wsDrainResolvers;
  wsDrainResolvers = [];
  rs.forEach((r) => r());
}

function resolveWsTurn(): void {
  wsTurnActive = false;
  turnActive = false;
  setSpeaking(false);
  resolveWsDrainers();
  flushDeferredOneShot();
}

// ws/token failure: stop future ws turns; speak the buffered reply over HTTP if
// nothing was heard yet, so a connect failure never means silence.
function handleWsError(_msg: string): void {
  if (!wsTurnActive) return;
  wsHealthy = false;
  const text = wsTurnChunks.join(' ').trim();
  const hadAudio = wsFirstAudio;
  wsCancel();
  wsTurnActive = false;
  wsTurnChunks = [];
  resolveWsTurn();
  if (!hadAudio && text) void speak(text);
}

function resolveDrainers(): void {
  const rs = drainResolvers;
  drainResolvers = [];
  rs.forEach((r) => r());
}

// Terminal: only place the queue flips speaking off + settles endSpeechTurn().
function finishTurn(): void {
  if (!turnActive) return;
  turnActive = false;
  prefetch = null;
  if (speakingHeld) {
    speakingHeld = false;
    setSpeaking(false);
  }
  resolveDrainers();
  flushDeferredOneShot();
}

function flushDeferredOneShot(): void {
  const pending = deferredOneShot;
  deferredOneShot = null;
  if (pending) void speak(pending.text, { volume: pending.volume });
}

// 1-ahead: synthesize playCursor+1 (if queued, not already pending) for this gen.
function maybePrefetchNext(gen: number): void {
  if (gen !== speakGeneration || prefetch || playCursor + 1 >= speechQueue.length) return;
  const next = speechQueue[playCursor + 1];
  const abort = new AbortController();
  const blobP = synthChunk(next.text, gen, abort);
  blobP.catch(() => null);
  prefetch = { text: next.text, gen, abort, blob: blobP };
}

async function runDrain(): Promise<void> {
  drainRunning = true;
  const gen = speakGeneration;
  while (playCursor < speechQueue.length) {
    if (gen !== speakGeneration) {
      drainRunning = false;
      if (turnSealed) finishTurn();
      return;
    }
    const item = speechQueue[playCursor];
    let blob: Blob | null;
    if (prefetch && prefetch.gen === gen && prefetch.text === item.text) {
      blob = await prefetch.blob;
      prefetch = null;
    } else {
      // Stale/non-matching prefetch — abort before synthesizing fresh.
      if (prefetch) {
        prefetch.abort.abort();
        prefetch = null;
      }
      const abort = new AbortController();
      playSynthAbort = abort;
      blob = await synthChunk(item.text, gen, abort);
    }
    // Next chunk may have arrived during synth — prefetch it before play.
    maybePrefetchNext(gen);
    if (gen !== speakGeneration) {
      drainRunning = false;
      if (turnSealed) finishTurn();
      return;
    }
    if (blob) {
      if (!speakingHeld) {
        speakingHeld = true;
        setSpeaking(true);
      }
      maybePrefetchNext(gen);
      await playChunkBlob(blob, item.volume, gen);
      if (gen !== speakGeneration) {
        drainRunning = false;
        if (turnSealed) finishTurn();
        return;
      }
    }
    playCursor++;
  }
  drainRunning = false;
  if (turnSealed) finishTurn();
}

export function beginSpeechTurn(): number {
  stopTTS();
  speechQueue = [];
  playCursor = 0;
  turnSealed = false;
  turnActive = true;
  const gen = ++speakGeneration;
  if (useWs()) {
    wsTurnActive = true;
    wsFirstAudio = false;
    wsTurnChunks = [];
    wsBegin({
      onSpeakingChange: (s) => setSpeaking(s),
      onFirstAudio: () => {
        wsFirstAudio = true;
      },
      onDrain: () => resolveWsTurn(),
      onError: (m) => handleWsError(m),
    });
  }
  return gen;
}

export function pushSpeechChunk(text: string, opts?: { volume?: number }): void {
  if (!turnActive || !isVoiceOutEnabled()) return;
  if (!text.trim()) return;
  if (wsTurnActive) {
    wsTurnChunks.push(text);
    void wsPush(text);
    return;
  }
  speechQueue.push({ text, volume: opts?.volume ?? 0.85 });
  if (!drainRunning) {
    drainRunning = true;
    void runDrain();
  } else {
    // arrived mid-playback — prefetch now so it's warm before its turn
    maybePrefetchNext(speakGeneration);
  }
}

export function endSpeechTurn(): Promise<void> {
  if (wsTurnActive) {
    // Nothing was spoken (tool-only turn) — close immediately, don't wait on `done`.
    if (wsTurnChunks.length === 0) {
      wsCancel();
      resolveWsTurn();
      return Promise.resolve();
    }
    void wsFinish();
    return new Promise<void>((resolve) => {
      if (!wsTurnActive) resolve();
      else wsDrainResolvers.push(resolve);
    });
  }
  turnSealed = true;
  if (!drainRunning && playCursor >= speechQueue.length) finishTurn();
  return new Promise<void>((resolve) => {
    if (!turnActive) resolve();
    else drainResolvers.push(resolve);
  });
}

export function stopTTS(): void {
  if (wsTurnActive) {
    wsCancel();
    wsTurnActive = false;
    wsTurnChunks = [];
    resolveWsDrainers();
  }
  ++speakGeneration;
  if (currentTtsAbort) {
    currentTtsAbort.abort();
    currentTtsAbort = null;
  }
  if (playSynthAbort) {
    playSynthAbort.abort();
    playSynthAbort = null;
  }
  if (prefetch) {
    prefetch.abort.abort();
    prefetch = null;
  }
  speechQueue = [];
  playCursor = 0;
  turnSealed = true;
  drainRunning = false;
  turnActive = false;
  speakingHeld = false;
  deferredOneShot = null;
  if (currentAudioResolver) {
    const resolver = currentAudioResolver;
    currentAudioResolver = null;
    resolver();
  } else if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  setSpeaking(false);
  resolveDrainers();
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Plays one decoded blob. Caller owns setSpeaking. Never rejects: a play error
// (incl. iOS NotAllowedError) resolves false so the queue skips, not wedges.
async function playChunkBlob(blob: Blob, volume: number, generation: number): Promise<boolean> {
  if (generation !== speakGeneration) return false;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  audio.volume = volume;
  currentAudio = audio;

  return await new Promise<boolean>((resolve) => {
    const cleanup = () => {
      URL.revokeObjectURL(audioUrl);
      if (currentAudio === audio) currentAudio = null;
      if (currentAudioResolver === settle) currentAudioResolver = null;
    };
    // onended OR external stopTTS() (via currentAudioResolver)
    const settle = () => {
      audio.pause();
      cleanup();
      resolve(true);
    };
    const fail = (err: unknown) => {
      cleanup();
      handleTtsError(err, 'Cartesia');
      resolve(false);
    };
    currentAudioResolver = settle;
    audio.onended = settle;
    audio.onerror = (e) => fail(e);
    audio.play().catch((err) => fail(err));
  });
}

/** Handle common TTS fetch errors — abort, autoplay, etc. */
function handleTtsError(err: unknown, label: string): boolean {
  // AbortError is expected when user interrupts TTS
  if (err instanceof DOMException && err.name === 'AbortError') {
    console.log(`[TTS] ${label} stopped (user interrupted)`);
    return true; // Not a failure — intentional stop
  }
  if (err instanceof Error && err.name === 'AbortError') {
    console.log(`[TTS] ${label} stopped (user interrupted)`);
    return true;
  }
  // NotAllowedError = browser autoplay policy
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    console.log(`[TTS] ${label} autoplay blocked — waiting for user interaction.`);
    return false;
  }
  console.error(`[TTS] ${label} failed:`, err);
  return false;
}

// Synthesize one chunk → blob, or null on disabled/stale/error/abort. Caller
// owns the AbortController so play and 1-ahead prefetch cancel independently.
async function synthChunk(
  text: string,
  generation: number,
  abort: AbortController,
): Promise<Blob | null> {
  if (!cartesiaTtsAvailable) return null;
  const clean = cleanText(text);
  if (!clean) return null;
  try {
    const voiceId = getCartesiaVoiceId();
    const authHeaders = await getAuthHeaders();
    if (generation !== speakGeneration) return null;

    const res = await fetch(`${getApiBase()}/api/cartesia-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        text: clean,
        voice_id: voiceId,
        ...(Capacitor.isNativePlatform() ? { format: 'base64' } : {}),
      }),
      signal: abort.signal,
    });
    if (generation !== speakGeneration) return null;

    if (!res.ok) {
      console.warn('[TTS] Cartesia proxy error:', res.status);
      if (res.status === 429 || res.status === 401 || res.status === 500) {
        cartesiaTtsAvailable = false;
      }
      return null;
    }

    if (Capacitor.isNativePlatform()) {
      // CapacitorHttp's patched fetch corrupts binary bodies; base64-in-JSON survives
      const { audio } = (await res.json()) as { audio: string };
      return base64ToBlob(audio, 'audio/mpeg');
    }
    return await res.blob();
  } catch (err) {
    handleTtsError(err, 'Cartesia');
    return null;
  }
}

// One-shot path (non-coach callers): synth then play one blob, owns setSpeaking.
async function speakCartesia(text: string, volume: number, generation: number): Promise<boolean> {
  const abort = new AbortController();
  currentTtsAbort = abort;
  const blob = await synthChunk(text, generation, abort);
  if (generation !== speakGeneration || !blob) return false;
  setSpeaking(true);
  try {
    return await playChunkBlob(blob, volume, generation);
  } finally {
    if (generation === speakGeneration) setSpeaking(false);
  }
}

/** Strip emoji for cleaner TTS */
function cleanText(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

// 0.1s silent WAV. Played from inside a user-gesture handler so subsequent
// async <Audio> playbacks pass iOS Safari's first-play-must-be-gesture rule.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/**
 * Unlock TTS on iOS — must be called from a user gesture (click/tap handler).
 * iOS Safari blocks audio.play() unless the first call originates from a
 * user-initiated event. Call this on mic button tap / page entry.
 */
export function unlockTTS(): void {
  // Re-arm after transient 429/401/500 even when already unlocked.
  cartesiaTtsAvailable = true;
  wsHealthy = true;
  unlockPcmAudio();
  if (ttsUnlocked) return;
  try {
    const a = new Audio(SILENT_WAV);
    a.volume = 0;
    void a.play().catch(() => {
      /* iOS may still reject; non-fatal — flag flips below either way */
    });
  } catch {
    /* ignore */
  }
  ttsUnlocked = true;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a promise resolving when audio actually ends (onended, error,
 * external stopTTS, or a newer speak() superseding this one). Resolves
 * immediately when TTS is disabled or the text is empty.
 */
export function speak(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number },
): Promise<void> {
  if (!isVoiceOutEnabled()) return Promise.resolve();
  const clean = cleanText(text);
  if (!clean) return Promise.resolve();

  const volume = options?.volume ?? 0.85;

  // Don't tear down an in-progress coach turn — defer and play when it finishes.
  if (turnActive) {
    deferredOneShot = { text: clean, volume };
    return Promise.resolve();
  }

  stopTTS();
  const myGeneration = ++speakGeneration;

  return (async () => {
    const cartesiaOk = await speakCartesia(clean, volume, myGeneration);
    if (myGeneration !== speakGeneration) return;
    if (!cartesiaOk) {
      console.warn('[tts] Cartesia failed; audio skipped');
    }
  })();
}

/** Pre-acknowledgment messages — warm, concise, coaching-style */
const PRE_ACK_MESSAGES: Record<string, (params: Record<string, unknown>) => string> = {
  complete: () => `Got it.`,
  create: (p) => `Setting up ${p.name || 'that'}.`,
  delete: () => `On it.`,
  log: () => `Got it.`,
  query: () => `Let me check.`,
  reflect: () => `I hear you.`,
  suggest: () => `Let me think.`,
  update: () => `Updating now.`,
  checkin: () => `Got it.`,
  focus: () => `Let's go.`,
};

/**
 * Speak text, deferring to the next user gesture if the browser hasn't
 * unlocked autoplay yet. Use this for auto-greetings on page mount —
 * `speak()` directly will be silently blocked on iOS WKWebView and Safari
 * until the user has interacted with the page.
 *
 * If a gesture has already happened anywhere in the session, plays
 * immediately. Otherwise registers a one-shot listener that fires on the
 * first pointerdown/touchstart and is auto-removed.
 *
 * Returns a cleanup function — call it on component unmount to remove the
 * deferred listener if the user navigates away before interacting.
 */
export function speakWhenReady(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number },
): () => void {
  if (ttsUnlocked) {
    speak(text, options);
    return () => {};
  }

  const handler = () => {
    unlockTTS();
    speak(text, options);
  };

  // pointerdown covers both mouse and touch on modern browsers
  window.addEventListener('pointerdown', handler, { once: true, capture: true });

  return () => {
    window.removeEventListener('pointerdown', handler, { capture: true });
  };
}

/** Speak a short pre-acknowledgment before the actual action runs */
export function speakPreAck(action: string, params: Record<string, unknown>): void {
  const generator = PRE_ACK_MESSAGES[action];
  if (generator) {
    speak(generator(params), { rate: 1.15, volume: 0.75 });
  }
}
