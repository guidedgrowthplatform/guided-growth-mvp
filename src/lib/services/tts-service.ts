import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';
import { COACH_VOICE_ID, type VoiceGender } from '@/config/voiceConfig';
import { getAuthHeaders } from '@/lib/services/api-auth';
import { isVoiceOutEnabled } from './voiceGate';

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

// Per-turn auth-header cache — avoids a token read per chunk.
let authHeaderGen = -1;
let authHeaderCache: Record<string, string> = {};
async function getTurnAuthHeaders(generation: number): Promise<Record<string, string>> {
  if (authHeaderGen === generation) return authHeaderCache;
  const h = await getAuthHeaders();
  if (generation === speakGeneration) {
    authHeaderGen = generation;
    authHeaderCache = h;
  }
  return h;
}

// Track provider availability (disabled on quota exceeded / auth failure)
let cartesiaTtsAvailable = true;

let currentAudio: HTMLAudioElement | null = null;
let currentTtsAbort: AbortController | null = null;
// stopTTS() invokes this so awaited speak() resolves on external interrupt.
let currentAudioResolver: (() => void) | null = null;
// iOS Safari first-play rule — set by unlockTTS inside a gesture.
let ttsUnlocked = false;
const unlockListeners = new Set<() => void>();
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
// Pre-built + preloaded element for the next sentence — decoded during current playback.
let preloadedNext: { gen: number; text: string; audio: HTMLAudioElement; url: string } | null =
  null;
let drainResolvers: Array<() => void> = [];

function disposeElement(audio: HTMLAudioElement, url: string): void {
  audio.pause();
  audio.src = '';
  URL.revokeObjectURL(url);
}

function teardownPreloadedNext(): void {
  if (!preloadedNext) return;
  const { audio, url } = preloadedNext;
  preloadedNext = null;
  disposeElement(audio, url);
}

// Build + preload an element so it decodes while the current sentence plays.
function buildPreloadElement(blob: Blob): { audio: HTMLAudioElement; url: string } {
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;
  audio.load();
  return { audio, url };
}

// During current playback: resolve the in-flight prefetch blob and pre-build
// the next element, under the gen guard. Abandons if superseded.
async function preloadNextElement(gen: number): Promise<void> {
  if (gen !== speakGeneration || preloadedNext || !prefetch || prefetch.gen !== gen) return;
  const { text } = prefetch;
  const blob = await prefetch.blob;
  if (gen !== speakGeneration || preloadedNext) return;
  if (!blob) return;
  preloadedNext = { gen, text, ...buildPreloadElement(blob) };
}
let deferredOneShot: { text: string; volume: number } | null = null;

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
  teardownPreloadedNext();
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
    // Pre-built element from the previous iteration's preload — already decoded.
    let ready: { audio: HTMLAudioElement; url: string } | null = null;
    if (preloadedNext && preloadedNext.gen === gen && preloadedNext.text === item.text) {
      ready = { audio: preloadedNext.audio, url: preloadedNext.url };
      preloadedNext = null;
      if (prefetch && prefetch.text === item.text) prefetch = null;
    } else {
      // No matching preload — drop any stale one, then resolve a blob and build.
      teardownPreloadedNext();
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
      if (gen !== speakGeneration) {
        drainRunning = false;
        if (turnSealed) finishTurn();
        return;
      }
      if (blob) ready = buildPreloadElement(blob);
    }
    // Next chunk may have arrived during synth — prefetch it before play.
    maybePrefetchNext(gen);
    if (gen !== speakGeneration) {
      if (ready) disposeElement(ready.audio, ready.url);
      drainRunning = false;
      if (turnSealed) finishTurn();
      return;
    }
    if (ready) {
      if (!speakingHeld) {
        speakingHeld = true;
        setSpeaking(true);
      }
      maybePrefetchNext(gen);
      // Pre-build the next element while this one plays (closes per-sentence gap).
      void preloadNextElement(gen);
      await playChunkElement(ready.audio, ready.url, item.volume, gen);
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
  return ++speakGeneration;
}

export function pushSpeechChunk(text: string, opts?: { volume?: number }): void {
  if (!turnActive || !isVoiceOutEnabled()) return;
  if (!text.trim()) return;
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
  turnSealed = true;
  if (!drainRunning && playCursor >= speechQueue.length) finishTurn();
  return new Promise<void>((resolve) => {
    if (!turnActive) resolve();
    else drainResolvers.push(resolve);
  });
}

export function stopTTS(): void {
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
  teardownPreloadedNext();
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
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = 'auto';
  return playChunkElement(audio, url, volume, generation);
}

// Plays one pre-built+preloaded element. Caller owns setSpeaking. Never rejects.
async function playChunkElement(
  audio: HTMLAudioElement,
  audioUrl: string,
  volume: number,
  generation: number,
): Promise<boolean> {
  if (generation !== speakGeneration) {
    disposeElement(audio, audioUrl);
    return false;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
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
    const authHeaders = await getTurnAuthHeaders(generation);
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
      if (res.status === 401) {
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
  unlockListeners.forEach((fn) => fn());
}

export function isAudioUnlocked(): boolean {
  return ttsUnlocked;
}

export function subscribeAudioUnlock(fn: () => void): () => void {
  unlockListeners.add(fn);
  return () => unlockListeners.delete(fn);
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
