import { Capacitor } from '@capacitor/core';
import { supabase, sessionReady } from '@/lib/supabase';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

const VOICE_PREF_KEY = 'mvp03_tts_voice';

// ─── Voice Configuration ────────────────────────────────────────────────────
// User selects Male or Female on splash screen
export type VoiceGender = 'male' | 'female';

// Cartesia voice IDs (sonic-3 model) — primary TTS provider
const CARTESIA_VOICES: Record<VoiceGender, { id: string; name: string }> = {
  male: { id: 'a167e0f3-df7e-4c9d-9e09-98e2e4872788', name: 'Ronald' },
  female: { id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', name: 'Katie' },
};

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

// Track current playing audio so we can stop it
let currentAudio: HTMLAudioElement | null = null;
// Abort controller for in-flight TTS requests
let currentTtsAbort: AbortController | null = null;

/** Stop any currently playing TTS audio immediately */
export function stopTTS(): void {
  // Cancel in-flight TTS fetch request
  if (currentTtsAbort) {
    currentTtsAbort.abort();
    currentTtsAbort = null;
  }
  // Stop playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  // Stop browser speechSynthesis too (just in case)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Play audio from a fetch response blob.
 */
async function playAudioFromResponse(
  res: Response,
  volume: number,
  _label: string,
): Promise<boolean> {
  const audioBlob = await res.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.volume = volume;
  currentAudio = audio;

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      resolve();
    };
    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      reject(e);
    };
    audio.play().catch(reject);
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
 * Speak text using Cartesia TTS API (sonic-3, primary).
 * Primary cloud TTS provider.
 * Returns true if audio played successfully, false if should fall back.
 */
async function speakCartesia(text: string, volume: number): Promise<boolean> {
  if (!cartesiaTtsAvailable) return false;

  try {
    const voiceId = getCartesiaVoiceId();
    const authHeaders = await getAuthHeaders();

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

    if (!res.ok) {
      console.warn('[TTS] Cartesia proxy error:', res.status);
      if (res.status === 429 || res.status === 401 || res.status === 500) {
        cartesiaTtsAvailable = false;
      }
      return false;
    }

    return await playAudioFromResponse(res, volume, 'Cartesia');
  } catch (err) {
    return handleTtsError(err, 'Cartesia');
  }
}

// ─── Browser SpeechSynthesis (fallback) ─────────────────────────────────────

// Preferred voices ranked by quality (natural-sounding, pleasant)
const PREFERRED_VOICES = [
  'Google UK English Female',
  'Google US English',
  'Microsoft Zira',
  'Samantha', // macOS
  'Karen', // macOS Australian
  'Daniel', // macOS British
  'Google UK English Male',
  'Microsoft David',
];

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let ttsUnlocked = false;

function getVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

/** Find the best available voice, preferring natural-sounding English voices */
function findBestVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  // Check saved preference first
  const savedName = localStorage.getItem(VOICE_PREF_KEY);
  if (savedName) {
    const saved = voices.find((v) => v.name === savedName);
    if (saved) return saved;
  }

  // Try preferred voices in order
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }

  // Fallback: any English voice
  const english = voices.find((v) => v.lang.startsWith('en'));
  return english || voices[0] || null;
}

/** Get the currently selected voice (with lazy initialization) */
export function getSelectedVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice && voicesLoaded) return cachedVoice;
  cachedVoice = findBestVoice();
  voicesLoaded = getVoices().length > 0;
  return cachedVoice;
}

/** Save a specific voice preference */
export function setVoicePreference(voiceName: string): void {
  localStorage.setItem(VOICE_PREF_KEY, voiceName);
  const voices = getVoices();
  cachedVoice = voices.find((v) => v.name === voiceName) || cachedVoice;
}

/** Get the saved voice name */
export function getVoicePreference(): string | null {
  return localStorage.getItem(VOICE_PREF_KEY);
}

/** Get all available voices for the settings UI */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return getVoices().filter((v) => v.lang.startsWith('en'));
}

/** Strip emoji for cleaner TTS */
function cleanText(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

/**
 * Unlock TTS on iOS — must be called from a user gesture (click/tap handler).
 * iOS Safari blocks speechSynthesis.speak() unless the first call happens
 * inside a user-initiated event. Call this on mic button tap.
 */
export function unlockTTS(): void {
  if (ttsUnlocked || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
  ttsUnlocked = true;
}

/** Speak using browser SpeechSynthesis (fallback) */
function speakBrowser(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number },
): void {
  if (!('speechSynthesis' in window)) {
    console.warn('[TTS] Browser SpeechSynthesis not available');
    return;
  }

  const doSpeak = () => {
    // Cancel any stuck synthesis before speaking
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = options?.rate ?? 1.05;
    utterance.pitch = options?.pitch ?? 1.0;
    // Use full volume on Android WebView — lower values are often inaudible
    utterance.volume = options?.volume ?? 1.0;

    // iOS/Safari workaround: pauses synthesis after ~15s.
    // Resume periodically to prevent hanging. Clear on end/error.
    let resumeInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (resumeInterval) {
        clearInterval(resumeInterval);
        resumeInterval = null;
      }
    };

    utterance.onend = cleanup;
    utterance.onerror = (e) => {
      console.warn('[TTS] Browser speech error:', e);
      cleanup();
    };

    window.speechSynthesis.speak(utterance);

    resumeInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        cleanup();
      } else {
        window.speechSynthesis.resume();
      }
    }, 5000);
  };

  // Android WebView often loads voices asynchronously.
  // If no voices are available yet, wait for them then speak.
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    console.log('[TTS] No voices loaded yet, waiting...');
    const onVoicesReady = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
      cachedVoice = findBestVoice();
      voicesLoaded = true;
      doSpeak();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady);
    // Safety fallback: try speaking anyway after 500ms even without voices
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
      doSpeak();
    }, 500);
  } else {
    doSpeak();
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

// Generation counter — only the LATEST speak() call gets to play audio
let speakGeneration = 0;

/**
 * Speak text aloud using Cartesia TTS (primary),
 * then browser speechSynthesis as last resort.
 * Uses generation counter to ensure only the latest call plays.
 */
export function speak(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number },
): void {
  // Check if TTS is enabled
  const { ttsEnabled } = useVoiceSettingsStore.getState();
  if (!ttsEnabled) return;
  const clean = cleanText(text);
  if (!clean) return;

  const volume = options?.volume ?? 0.85;

  // ALWAYS stop current audio first to prevent overlap
  stopTTS();

  // Increment generation — any in-flight speak() from earlier calls will be stale
  const myGeneration = ++speakGeneration;

  // Cascade: Cartesia → Browser speechSynthesis
  (async () => {
    // Try Cartesia (primary — sole cloud TTS provider)
    const cartesiaOk = await speakCartesia(clean, volume);
    if (myGeneration !== speakGeneration) return;
    if (cartesiaOk) return;

    // Cartesia failed — use browser speechSynthesis as emergency fallback
    speakBrowser(clean, options);
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

// Load voices when they become available (Chrome loads async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voicesLoaded = true;
    cachedVoice = findBestVoice();
  };
  // Trigger initial load
  getVoices();
}
