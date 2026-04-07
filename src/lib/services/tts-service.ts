import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

const VOICE_PREF_KEY = 'mvp03_tts_voice';

// ─── ElevenLabs Voice IDs ───────────────────────────────────────────────────
// Per Voice Journey Spreadsheet: user selects Male or Female on splash screen
export type VoiceGender = 'male' | 'female';

const ELEVENLABS_VOICES: Record<VoiceGender, { id: string; name: string }> = {
  male: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },     // Adam — calm, natural male
  female: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },  // Sarah — natural female
};

const VOICE_GENDER_KEY = 'guided_growth_voice_gender';

/** Get the user's selected voice gender (defaults to male) */
export function getVoiceGender(): VoiceGender {
  try {
    const saved = localStorage.getItem(VOICE_GENDER_KEY);
    if (saved === 'female') return 'female';
  } catch { /* ignore */ }
  return 'female';
}

/** Set the user's voice gender preference */
export function setVoiceGender(gender: VoiceGender): void {
  try {
    localStorage.setItem(VOICE_GENDER_KEY, gender);
  } catch { /* ignore */ }
}

/** Get ElevenLabs voice ID for the user's selected gender */
function getElevenLabsVoiceId(): string {
  const gender = getVoiceGender();
  return ELEVENLABS_VOICES[gender].id;
}

// ─── ElevenLabs TTS (primary) ───────────────────────────────────────────────

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[TTS] VITE_API_URL not set — ElevenLabs TTS will fail on native');
  }
  return '';
}

/** Get auth headers for the TTS proxy */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
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

// Track whether ElevenLabs TTS is available (disabled on quota exceeded)
let elevenLabsTtsAvailable = true;

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
 * Speak text using ElevenLabs TTS API (natural voice).
 * Returns true if audio played successfully, false if should fall back.
 */
async function speakElevenLabs(text: string, volume: number): Promise<boolean> {
  if (!elevenLabsTtsAvailable) return false;

  try {
    const voiceId = getElevenLabsVoiceId();
    const authHeaders = await getAuthHeaders();

    // Create abort controller so stopTTS() can cancel in-flight requests
    const abortController = new AbortController();
    currentTtsAbort = abortController;

    // Call proxy — in dev, Vite middleware handles it; in production, Vercel serverless
    const res = await fetch(`${getApiBase()}/api/elevenlabs-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ text, voice_id: voiceId }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      console.error('[TTS] ElevenLabs proxy error:', res.status);
      if (res.status === 429 || res.status === 401) {
        elevenLabsTtsAvailable = false;
      }
      return false;
    }

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
  } catch (err) {
    // AbortError is expected when user interrupts TTS — don't log as error
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log('[TTS] Stopped (user interrupted)');
      return true; // Not a failure — intentional stop
    }
    if (err instanceof Error && err.name === 'AbortError') {
      console.log('[TTS] Stopped (user interrupted)');
      return true;
    }
    console.error('[TTS] ElevenLabs TTS failed:', err);
    return false;
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
  if (!('speechSynthesis' in window)) return;

  // iOS workaround: cancel any stuck synthesis before speaking
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getSelectedVoice();
  if (voice) utterance.voice = voice;

  utterance.rate = options?.rate ?? 1.05;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = options?.volume ?? 0.85;

  // iOS workaround: Safari pauses synthesis after ~15s.
  // Resume periodically to prevent hanging. Clear on end/error.
  let resumeInterval: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (resumeInterval) {
      clearInterval(resumeInterval);
      resumeInterval = null;
    }
  };

  utterance.onend = cleanup;
  utterance.onerror = cleanup;

  window.speechSynthesis.speak(utterance);

  resumeInterval = setInterval(() => {
    if (!window.speechSynthesis.speaking) {
      cleanup();
    } else {
      window.speechSynthesis.resume();
    }
  }, 5000);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Speak text aloud using ElevenLabs TTS (natural voice).
 * ElevenLabs is the ONLY TTS provider — no browser fallback.
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

  // ElevenLabs first, browser fallback if unavailable
  // ALWAYS stop current audio first to prevent overlap
  stopTTS();

  speakElevenLabs(clean, volume).then((success) => {
    if (!success) {
      console.warn('[TTS] ElevenLabs unavailable — falling back to browser voice.');
      speakBrowser(clean, options);
    }
  });
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
