import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';
import { CARTESIA_VOICES, type VoiceGender } from '@/config/voiceConfig';
import { supabase, sessionReady } from '@/lib/supabase';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

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

/** Get Cartesia voice ID for the user's selected gender */
function getCartesiaVoiceId(): string {
  const gender = getVoiceGender();
  return CARTESIA_VOICES[gender].id;
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
// Bumped per speak(); stale callers bail at each await boundary.
let speakGeneration = 0;

export function stopTTS(): void {
  if (currentTtsAbort) {
    currentTtsAbort.abort();
    currentTtsAbort = null;
  }
  if (currentAudioResolver) {
    const resolver = currentAudioResolver;
    currentAudioResolver = null;
    resolver();
    return;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  setSpeaking(false);
}

async function playAudioFromResponse(
  res: Response,
  volume: number,
  _label: string,
  generation: number,
): Promise<boolean> {
  const audioBlob = await res.blob();
  if (generation !== speakGeneration) return false;

  // Hard-stop any peer playAudioFromResponse that resolved its blob in
  // the same tick before we overwrite currentAudio.
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }

  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.volume = volume;
  currentAudio = audio;

  await new Promise<void>((resolve, reject) => {
    const onFinish = () => {
      audio.pause();
      URL.revokeObjectURL(audioUrl);
      if (currentAudio === audio) currentAudio = null;
      if (currentAudioResolver === onFinish) currentAudioResolver = null;
      setSpeaking(false);
      resolve();
    };
    currentAudioResolver = onFinish;
    audio.onended = onFinish;
    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      if (currentAudio === audio) currentAudio = null;
      if (currentAudioResolver === onFinish) currentAudioResolver = null;
      setSpeaking(false);
      reject(e);
    };
    setSpeaking(true);
    audio.play().catch((err) => {
      if (currentAudio === audio) currentAudio = null;
      if (currentAudioResolver === onFinish) currentAudioResolver = null;
      setSpeaking(false);
      reject(err);
    });
  });

  return true;
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

/**
 * Speak text using Cartesia TTS API (sonic-3, primary and only provider).
 * Returns true if audio played successfully, false on failure.
 * No fallback: callers accept silent failure (visible chat message remains).
 */
async function speakCartesia(text: string, volume: number, generation: number): Promise<boolean> {
  if (!cartesiaTtsAvailable) return false;

  try {
    const voiceId = getCartesiaVoiceId();
    const authHeaders = await getAuthHeaders();
    if (generation !== speakGeneration) return false;

    const abortController = new AbortController();
    currentTtsAbort = abortController;

    const res = await fetch(`${getApiBase()}/api/cartesia-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ text, voice_id: voiceId }),
      signal: abortController.signal,
    });
    if (generation !== speakGeneration) return false;

    if (!res.ok) {
      console.warn('[TTS] Cartesia proxy error:', res.status);
      if (res.status === 429 || res.status === 401 || res.status === 500) {
        cartesiaTtsAvailable = false;
      }
      return false;
    }

    return await playAudioFromResponse(res, volume, 'Cartesia', generation);
  } catch (err) {
    return handleTtsError(err, 'Cartesia');
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
  const { ttsEnabled } = useVoiceSettingsStore.getState();
  if (!ttsEnabled) return Promise.resolve();
  const clean = cleanText(text);
  if (!clean) return Promise.resolve();

  const volume = options?.volume ?? 0.85;

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
